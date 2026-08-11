import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  app,
  canopyProofIsLegacyEvidenceNetworkRoute,
  canopyProofLegacyEvidenceNetworkEnabled,
  canopyProofRequiresPendingEvidencePersistence,
  canopyProofRequiresPendingPartnerPersistence,
  canopyProofRequiresPendingVerificationPersistence,
} from "../../services/api/src/app.js";
import { CanopyProofIdentityService } from "../../services/api/src/domain/canopyproof/identity.js";
import { CanopyProofPartnerService } from "../../services/api/src/domain/canopyproof/partner-collaboration.js";
import {
  canopyProofTrustRegistryConfigurationStatus,
  CanopyProofTrustRegistryError,
  PrismaCanopyProofTrustRegistryService,
} from "../../services/api/src/domain/canopyproof/trust-registry.js";

test("CanopyProof identity authority snapshots isolate production command calculation", () => {
  const source = new CanopyProofIdentityService();
  const participant = source.registerParticipant(
    {
      id: "cp_identity_hydrated_001",
      participantType: "human",
      displayName: "Hydrated Institutional Reviewer",
      roles: ["verifier"],
      verificationStatus: "verified",
      reputationScore: 50,
      credentialCommitments: ["a".repeat(64)],
      createdAt: "2026-07-11T00:00:00.000Z",
    },
    "owner_hydrated_001",
  );
  const hydrated = CanopyProofIdentityService.fromAuthoritySnapshot({ participants: [participant], reputationSnapshots: [] });
  const snapshot = hydrated.recordReputationSnapshot(
    participant.id,
    {
      newScore: 75,
      source: "human_review",
      reason: "Independent reviewer confirmed the participant authority snapshot.",
      recordedAt: "2026-07-11T00:01:00.000Z",
    },
    "verifier_hydrated_001",
  );

  assert.equal(hydrated.getParticipant(participant.id).reputationScore, 75);
  assert.equal(source.getParticipant(participant.id).reputationScore, 50);
  assert.equal(source.listReputationSnapshots(participant.id).length, 0);
  assert.equal(snapshot.auditEvent.previousRoot, participant.auditHistory.at(-1)?.eventRoot);
});

test("CanopyProof partner authority snapshots preserve idempotency and reject conflicting grants", () => {
  const source = new CanopyProofPartnerService();
  const organizationInput = {
    id: "cp_org_hydrated_001",
    name: "Hydrated Verification Institute",
    organizationType: "auditor",
    jurisdiction: "GLOBAL",
    publicContact: "registry@example.org",
    operatingRegions: ["global"],
    verificationCapabilities: ["environmental proof review"],
    dataSharingPolicy: "restricted",
    createdAt: "2026-07-11T00:00:00.000Z",
  } as const;
  const organization = source.registerOrganization(organizationInput, "owner_hydrated_001");
  const hydrated = CanopyProofPartnerService.fromAuthoritySnapshot({
    organizations: [organization],
    memberships: [],
    accreditations: [],
  });
  const replayedOrganization = hydrated.registerOrganization(organizationInput, "owner_hydrated_001");
  assert.equal(replayedOrganization.profileHash, organization.profileHash);

  const membershipInput = {
    actorId: "verifier_hydrated_001",
    role: "verifier",
    conflictDisclosure: "No project payment or certificate issuance conflict.",
    grantedAt: "2026-07-11T00:02:00.000Z",
  } as const;
  const membership = hydrated.grantMembership(organization.id, membershipInput, "owner_hydrated_001");
  assert.equal(hydrated.grantMembership(organization.id, membershipInput, "owner_hydrated_001").id, membership.id);
  assert.throws(
    () =>
      hydrated.grantMembership(
        organization.id,
        { ...membershipInput, grantedAt: "2026-07-11T00:03:00.000Z" },
        "owner_hydrated_001",
      ),
    /membership already exists/,
  );
});

test("CanopyProof partner snapshots derive immutable agreement revocation and supersession state", () => {
  const revokedSource = new CanopyProofPartnerService();
  const revokedOrganization = revokedSource.registerOrganization(
    {
      id: "cp_org_hydrated_agreement_revoked",
      name: "Hydrated Data Governance Institute",
      organizationType: "auditor",
      jurisdiction: "GLOBAL",
      publicContact: "governance@example.org",
      operatingRegions: ["global"],
      verificationCapabilities: ["data governance review"],
      createdAt: "2026-07-11T01:00:00.000Z",
    },
    "owner_hydrated_agreement",
  );
  const revokedAgreement = revokedSource.createDataSharingAgreement(
    revokedOrganization.id,
    {
      datasetScopes: ["proof summaries"],
      privacyTier: "restricted",
      permittedUses: ["institutional review"],
      expiresAt: "2027-07-11T01:00:00.000Z",
      createdAt: "2026-07-11T01:01:00.000Z",
    },
    "owner_hydrated_agreement",
  );
  const revocation = revokedSource.revokeDataSharingAgreement(
    revokedAgreement.id,
    {
      rationale: "Independent governance review withdrew future data access authority.",
      evidenceEventRoots: ["a".repeat(64)],
      revokedAt: "2026-07-11T01:02:00.000Z",
    },
    "owner_hydrated_agreement",
  );
  const revokedHydrated = CanopyProofPartnerService.fromAuthoritySnapshot({
    organizations: [revokedSource.getOrganization(revokedOrganization.id)],
    memberships: [],
    accreditations: [],
    dataSharingAgreements: revokedSource.listDataSharingAgreements(revokedOrganization.id),
    dataSharingAgreementRevocations: revokedSource.listDataSharingAgreementRevocations(revokedAgreement.id),
    dataSharingAgreementSupersessions: [],
  });
  const revokedView = revokedHydrated.listDataSharingAgreements(revokedOrganization.id)[0];
  assert.equal(revokedView?.revoked, true);
  assert.equal(revokedView?.auditEvent.entityType, "data_sharing_agreement");
  assert.equal(revokedHydrated.getDataSharingAgreementRevocation(revocation.id).revocationRoot, revocation.revocationRoot);

  const supersededSource = new CanopyProofPartnerService();
  const supersededOrganization = supersededSource.registerOrganization(
    {
      id: "cp_org_hydrated_agreement_superseded",
      name: "Hydrated Agreement Lineage Institute",
      organizationType: "research_institution",
      jurisdiction: "GLOBAL",
      publicContact: "lineage@example.org",
      operatingRegions: ["global"],
      verificationCapabilities: ["methodology review"],
      createdAt: "2026-07-11T02:00:00.000Z",
    },
    "owner_hydrated_lineage",
  );
  const predecessor = supersededSource.createDataSharingAgreement(
    supersededOrganization.id,
    {
      datasetScopes: ["method summaries"],
      privacyTier: "restricted",
      permittedUses: ["research review"],
      expiresAt: "2027-07-11T02:00:00.000Z",
      createdAt: "2026-07-11T02:01:00.000Z",
    },
    "owner_hydrated_lineage",
  );
  const supersession = supersededSource.supersedeDataSharingAgreement(
    predecessor.id,
    {
      transitionType: "renewal",
      successor: {
        datasetScopes: ["method summaries"],
        privacyTier: "restricted",
        permittedUses: ["research review"],
        expiresAt: "2028-07-11T02:00:00.000Z",
      },
      rationale: "Renew the unchanged least-privilege scope after institutional review.",
      evidenceEventRoots: ["b".repeat(64)],
      supersededAt: "2026-07-11T02:02:00.000Z",
    },
    "owner_hydrated_lineage",
  );
  const supersededHydrated = CanopyProofPartnerService.fromAuthoritySnapshot({
    organizations: [supersededSource.getOrganization(supersededOrganization.id)],
    memberships: [],
    accreditations: [],
    dataSharingAgreements: supersededSource.listDataSharingAgreements(supersededOrganization.id),
    dataSharingAgreementRevocations: [],
    dataSharingAgreementSupersessions: supersededSource.listDataSharingAgreementSupersessions(predecessor.id),
  });
  const agreementViews = supersededHydrated.listDataSharingAgreements(supersededOrganization.id);
  assert.equal(agreementViews.find((agreement) => agreement.id === predecessor.id)?.superseded, true);
  assert.equal(
    agreementViews.find((agreement) => agreement.id === supersession.successorAgreementId)?.supersedesAgreementId,
    predecessor.id,
  );
});

test("CanopyProof partner snapshots replay append-only data access decisions without mutating the request fact", () => {
  const source = new CanopyProofPartnerService();
  const organization = source.registerOrganization(
    {
      id: "cp_org_hydrated_data_access",
      name: "Hydrated Purpose Governance Institute",
      organizationType: "auditor",
      jurisdiction: "GLOBAL",
      registrationNumber: "HYDRATED-ACCESS-001",
      publicContact: "access-governance@example.org",
      operatingRegions: ["global"],
      verificationCapabilities: ["independent access review"],
      verificationStatus: "verified",
      trustLevel: "verified",
      documents: [
        {
          documentType: "registration",
          documentHash: "c".repeat(64),
          issuedBy: "Hydrated Test Registry",
          uploadedAt: "2026-07-11T03:00:00.000Z",
        },
      ],
      createdAt: "2026-07-11T03:00:00.000Z",
    },
    "owner_hydrated_access",
  );
  const agreement = source.createDataSharingAgreement(
    organization.id,
    {
      datasetScopes: ["proof summaries"],
      privacyTier: "restricted",
      permittedUses: ["institutional review"],
      expiresAt: "2027-07-11T03:00:00.000Z",
      createdAt: "2026-07-11T03:01:00.000Z",
    },
    "owner_hydrated_access",
  );
  const requestFact = source.requestDataAccess(
    organization.id,
    {
      agreementId: agreement.id,
      datasetScopes: ["proof summaries"],
      privacyTier: "restricted",
      permittedUses: ["institutional review"],
      purpose: "Review bounded proof summaries for institutional quality assurance.",
      requestedAt: "2026-07-11T03:02:00.000Z",
      expiresAt: "2027-01-11T03:02:00.000Z",
    },
    "researcher_hydrated_access",
  );
  source.decideDataAccessRequest(
    requestFact.id,
    {
      status: "approved",
      rationale: "Approved by an independent human verifier within the agreement boundary.",
      decidedAt: "2026-07-11T03:03:00.000Z",
    },
    "verifier_hydrated_access",
  );
  source.decideDataAccessRequest(
    requestFact.id,
    {
      status: "revoked",
      rationale: "Revoked when the bounded institutional review window was administratively closed.",
      decidedAt: "2026-07-11T03:04:00.000Z",
    },
    "verifier_hydrated_access",
  );
  const decisions = source.listDataAccessRequestDecisions(requestFact.id);
  const snapshot = {
    organizations: [source.getOrganization(organization.id)],
    memberships: [],
    accreditations: [],
    dataSharingAgreements: [agreement],
    dataSharingAgreementRevocations: [],
    dataSharingAgreementSupersessions: [],
    dataAccessRequests: [requestFact],
    dataAccessRequestDecisions: decisions,
  } as const;
  const hydrated = CanopyProofPartnerService.fromAuthoritySnapshot(snapshot);
  const current = hydrated.getDataAccessRequest(requestFact.id);
  assert.equal(requestFact.status, "pending");
  assert.equal(requestFact.decisionBy, undefined);
  assert.equal(current.status, "revoked");
  assert.equal(current.auditEvent.entityType, "data_access_request");
  assert.equal(current.decisionAuditEvent?.entityType, "data_access_request_decision");
  assert.equal(hydrated.listDataAccessRequestDecisions(requestFact.id).length, 2);

  const firstDecision = decisions[0]!;
  assert.throws(
    () =>
      CanopyProofPartnerService.fromAuthoritySnapshot({
        ...snapshot,
        dataAccessRequestDecisions: [{ ...firstDecision, previousStatus: "approved" }, decisions[1]!],
      }),
    /decision predecessor is invalid/,
  );
});

test("CanopyProof partner snapshots preserve delivery, use, and independent enforcement review across later revocation", () => {
  const source = new CanopyProofPartnerService();
  const organization = source.registerOrganization(
    {
      id: "cp_org_hydrated_delivery",
      name: "Hydrated Delivery Governance Institute",
      organizationType: "auditor",
      jurisdiction: "GLOBAL",
      registrationNumber: "HYDRATED-DELIVERY-001",
      publicContact: "delivery-governance@example.org",
      operatingRegions: ["global"],
      verificationCapabilities: ["purpose-bound data delivery review"],
      verificationStatus: "verified",
      trustLevel: "verified",
      documents: [
        {
          documentType: "registration",
          documentHash: "d".repeat(64),
          issuedBy: "Hydrated Test Registry",
          uploadedAt: "2026-07-11T03:10:00.000Z",
        },
      ],
      createdAt: "2026-07-11T03:10:00.000Z",
    },
    "owner_hydrated_delivery",
  );
  const agreement = source.createDataSharingAgreement(
    organization.id,
    {
      datasetScopes: ["proof summaries"],
      privacyTier: "restricted",
      permittedUses: ["institutional review"],
      expiresAt: "2027-07-11T03:10:00.000Z",
      createdAt: "2026-07-11T03:11:00.000Z",
    },
    "owner_hydrated_delivery",
  );
  const requestFact = source.requestDataAccess(
    organization.id,
    {
      agreementId: agreement.id,
      datasetScopes: ["proof summaries"],
      privacyTier: "restricted",
      permittedUses: ["institutional review"],
      purpose: "Review bounded proof summaries for an institutional assurance assessment.",
      requestedAt: "2026-07-11T03:12:00.000Z",
      expiresAt: "2027-01-11T03:12:00.000Z",
    },
    "researcher_hydrated_delivery",
  );
  source.decideDataAccessRequest(
    requestFact.id,
    {
      status: "approved",
      rationale: "An independent human verifier approved the bounded purpose and scope.",
      decidedAt: "2026-07-11T03:13:00.000Z",
    },
    "verifier_hydrated_delivery",
  );
  const receipt = source.recordDataAccessDelivery(
    requestFact.id,
    {
      manifestId: "cp_audit_export_hydrated_delivery",
      manifestRequesterOrganizationId: organization.id,
      manifestHash: "e".repeat(64),
      manifestEntryRoot: "f".repeat(64),
      manifestClassification: "restricted",
      channel: "audit_export_manifest",
      recipientActorId: "researcher_hydrated_delivery",
      purpose: "Deliver the approved hash-only review package to the named researcher.",
      deliveredAt: "2026-07-11T03:14:00.000Z",
    },
    "verifier_hydrated_delivery",
  );
  const withinScope = source.recordDataUseAttestation(
    receipt.id,
    {
      usageState: "within_scope",
      useCase: "Review the redacted hash-only package within the approved institutional scope.",
      outputHashes: ["7".repeat(64)],
      limitations: ["No raw evidence or private contact material was included."],
      attestedAt: "2026-07-11T03:14:30.000Z",
    },
    "researcher_hydrated_delivery",
  );
  source.decideDataAccessRequest(
    requestFact.id,
    {
      status: "revoked",
      rationale: "Close all future access after the approved delivery was registered.",
      decidedAt: "2026-07-11T03:15:00.000Z",
    },
    "verifier_hydrated_delivery",
  );
  source.revokeDataSharingAgreement(
    agreement.id,
    {
      rationale: "Withdraw all future delivery authority while preserving prior immutable receipts.",
      evidenceEventRoots: [receipt.auditEvent.eventRoot],
      revokedAt: "2026-07-11T03:16:00.000Z",
    },
    "owner_hydrated_delivery",
  );
  const noUse = source.recordDataUseAttestation(
    receipt.id,
    {
      usageState: "no_use",
      useCase: "Confirm no additional use occurred after request and agreement revocation.",
      limitations: ["No output hash exists because no later use occurred."],
      attestedAt: "2026-07-11T03:17:00.000Z",
    },
    "researcher_hydrated_delivery",
  );
  const challenge = source.recordDataUseAttestation(
    receipt.id,
    {
      usageState: "misuse_challenged",
      useCase: "Challenge suspected redistribution after the governed access authority ended.",
      evidenceEventRoots: ["8".repeat(64)],
      limitations: ["The challenge remains subject to independent human review."],
      attestedAt: "2026-07-11T03:18:00.000Z",
    },
    "verifier_hydrated_delivery",
  );
  assert.throws(
    () =>
      source.recordDataUseEnforcementCase(
        challenge.id,
        {
          caseState: "under_review",
          enforcementAction: "notify_partner",
          rationale: "The delivery recipient cannot independently review the challenge concerning their own use.",
          evidenceEventRoots: ["9".repeat(64)],
          reviewedAt: "2026-07-11T03:18:30.000Z",
        },
        "researcher_hydrated_delivery",
      ),
    /independent human reviewer/,
  );
  const enforcementCase = source.recordDataUseEnforcementCase(
    challenge.id,
    {
      caseState: "remediation_required",
      enforcementAction: "require_remediation",
      rationale: "Preserve the challenged hash lineage for independent institutional review after authority withdrawal.",
      evidenceEventRoots: ["9".repeat(64)],
      reviewedAt: "2026-07-11T03:19:00.000Z",
    },
    "owner_hydrated_delivery",
  );
  assert.equal(
    source.recordDataUseEnforcementCase(
      challenge.id,
      {
        caseState: "remediation_required",
        enforcementAction: "require_remediation",
        rationale: "Preserve the challenged hash lineage for independent institutional review after authority withdrawal.",
        evidenceEventRoots: ["9".repeat(64)],
        reviewedAt: "2026-07-11T03:19:00.000Z",
      },
      "owner_hydrated_delivery",
    ).id,
    enforcementCase.id,
  );
  const restriction = source.recordDataAccessRestriction(
    enforcementCase.id,
    {
      restrictionState: "remediation_hold",
      rationale: "Hold future governed delivery while remediation evidence is independently assessed.",
      evidenceEventRoots: ["a".repeat(64)],
      decidedAt: "2026-07-11T03:20:00.000Z",
      expiresAt: "2026-08-11T03:20:00.000Z",
    },
    "admin_hydrated_delivery",
  );
  const historicalPacket = source.createDataAccessAccountabilityPacket(
    requestFact.id,
    {
      intendedAudience: "independent institutional snapshot reviewer",
      generatedAt: "2026-07-11T03:20:30.000Z",
    },
    "verifier_hydrated_delivery",
  );
  assert.equal(historicalPacket.counts.activeRestrictionCount, 1);
  assert.equal(historicalPacket.counts.totalRestrictionCount, 1);
  const historicalVerification = source.verifyDataAccessAccountabilityPacket(
    historicalPacket.id,
    {
      expectedPacketRoot: historicalPacket.packetRoot,
      verifiedAt: "2026-07-11T03:20:40.000Z",
    },
    "governor_hydrated_delivery",
  );
  assert.equal(historicalVerification.valid, true);
  const historicalDisclosure = source.publishDataAccessAccountabilityDisclosure(
    historicalPacket.id,
    {
      verificationId: historicalVerification.id,
      publishedAt: "2026-07-11T03:20:50.000Z",
    },
    "admin_hydrated_delivery",
  );
  assert.equal(historicalDisclosure.currentState, "current");
  const historicalDisclosureChallenge = source.challengeDataAccessAccountabilityDisclosure(
    historicalDisclosure.id,
    {
      reason: "source_verification_disputed",
      statement: "Request an independent review of the source verification retained by this disclosure.",
      evidenceEventRoots: [historicalDisclosure.auditEvent.eventRoot],
      challengedAt: "2026-07-11T03:20:55.000Z",
    },
    "researcher_hydrated_delivery",
    "researcher",
  );
  const historicalEvidenceRequestResolution = source.resolveDataAccessAccountabilityDisclosureChallenge(
    historicalDisclosureChallenge.id,
    {
      decision: "needs_more_evidence",
      remedialAction: "none",
      rationale: "Independent review requests one additional governed event before a final public finding.",
      evidenceEventRoots: [historicalDisclosureChallenge.auditEvent.eventRoot],
      reviewedAt: "2026-07-11T03:20:56.000Z",
    },
    "verifier_hydrated_delivery",
    "verifier",
  );
  const historicalCorrectionResolution = source.resolveDataAccessAccountabilityDisclosureChallenge(
    historicalDisclosureChallenge.id,
    {
      decision: "upheld",
      remedialAction: "publish_correction",
      rationale: "The additional governed event requires a public correction linked to a replacement disclosure.",
      evidenceEventRoots: [historicalEvidenceRequestResolution.auditEvent.eventRoot],
      reviewedAt: "2026-07-11T03:20:57.000Z",
    },
    "governor_hydrated_delivery",
    "owner",
  );
  const resolvedCase = source.recordDataUseEnforcementCase(
    challenge.id,
    {
      caseState: "resolved",
      enforcementAction: "notify_partner",
      rationale: "Independent review accepted remediation evidence without altering historical challenge facts.",
      evidenceEventRoots: ["b".repeat(64)],
      reviewedAt: "2026-07-11T03:21:00.000Z",
    },
    "owner_hydrated_delivery",
  );
  const restoredRestriction = source.recordDataAccessRestriction(
    resolvedCase.id,
    {
      restrictionState: "restored",
      rationale: "Restore only the restriction layer after a separate resolved review and independent approval.",
      evidenceEventRoots: ["c".repeat(64)],
      decidedAt: "2026-07-11T03:22:00.000Z",
    },
    "governor_hydrated_delivery",
  );
  const replacementPacket = source.createDataAccessAccountabilityPacket(
    requestFact.id,
    {
      intendedAudience: "replacement disclosure snapshot reviewer",
      generatedAt: "2026-07-11T03:22:10.000Z",
    },
    "verifier_hydrated_delivery",
  );
  const replacementVerification = source.verifyDataAccessAccountabilityPacket(
    replacementPacket.id,
    {
      expectedPacketRoot: replacementPacket.packetRoot,
      verifiedAt: "2026-07-11T03:22:20.000Z",
    },
    "governor_hydrated_delivery",
  );
  const replacementDisclosure = source.publishDataAccessAccountabilityDisclosure(
    replacementPacket.id,
    {
      verificationId: replacementVerification.id,
      publishedAt: "2026-07-11T03:22:30.000Z",
    },
    "admin_hydrated_delivery",
  );
  const correctionNotice = source.publishDataAccessAccountabilityDisclosureNotice(
    historicalCorrectionResolution.id,
    {
      noticeType: "correction",
      replacementDisclosureId: replacementDisclosure.id,
      statement: "The original remains immutable and is corrected by the linked replacement disclosure.",
      evidenceEventRoots: [historicalCorrectionResolution.auditEvent.eventRoot],
      publishedAt: "2026-07-11T03:22:40.000Z",
    },
    "owner_hydrated_delivery",
    "owner",
  );
  const replacementChallenge = source.challengeDataAccessAccountabilityDisclosure(
    replacementDisclosure.id,
    {
      reason: "source_verification_disputed",
      statement: "A later challenge must remain visible without invalidating the historical correction boundary.",
      evidenceEventRoots: [replacementDisclosure.auditEvent.eventRoot],
      challengedAt: "2026-07-11T03:22:50.000Z",
    },
    "researcher_hydrated_delivery",
    "researcher",
  );
  assert.throws(
    () =>
      source.recordDataUseAttestation(
        receipt.id,
        {
          usageState: "within_scope",
          useCase: "Attempt to assert continued use after authority was revoked.",
          outputHashes: ["9".repeat(64)],
          attestedAt: "2026-07-11T03:19:00.000Z",
        },
        "researcher_hydrated_delivery",
      ),
    /within-scope data use requires an approved data access request/,
  );
  const snapshot = {
    organizations: [source.getOrganization(organization.id)],
    memberships: [],
    accreditations: [],
    dataSharingAgreements: source.listDataSharingAgreements(organization.id),
    dataSharingAgreementRevocations: source.listDataSharingAgreementRevocations(agreement.id),
    dataSharingAgreementSupersessions: [],
    dataAccessRequests: [requestFact],
    dataAccessRequestDecisions: source.listDataAccessRequestDecisions(requestFact.id),
    dataAccessDeliveryReceipts: source.listDataAccessDeliveryReceipts(requestFact.id),
    dataUseAttestations: source.listDataUseAttestations(receipt.id),
    dataUseEnforcementCases: source.listDataUseEnforcementCases(challenge.id),
    dataAccessRestrictions: source.listDataAccessRestrictions(requestFact.id),
    dataAccessAccountabilityPackets: source.listDataAccessAccountabilityPackets(requestFact.id),
    dataAccessAccountabilityVerifications: source.listDataAccessAccountabilityVerifications(),
    dataAccessAccountabilityDisclosures: source.listDataAccessAccountabilityDisclosures({
      organizationId: organization.id,
    }),
    dataAccessAccountabilityDisclosureChallenges: source.listDataAccessAccountabilityDisclosureChallenges(),
    dataAccessAccountabilityDisclosureResolutions: source.listDataAccessAccountabilityDisclosureResolutions(),
    dataAccessAccountabilityDisclosureNotices: source.listDataAccessAccountabilityDisclosureNotices(),
  } as const;

  const hydrated = CanopyProofPartnerService.fromAuthoritySnapshot(snapshot);
  assert.equal(hydrated.getDataAccessRequest(requestFact.id).status, "revoked");
  assert.equal(hydrated.getDataAccessDeliveryReceipt(receipt.id).deliveryRoot, receipt.deliveryRoot);
  assert.equal(hydrated.listDataAccessDeliveryReceipts(requestFact.id).length, 1);
  assert.equal(hydrated.getDataUseAttestation(withinScope.id).usageRoot, withinScope.usageRoot);
  assert.equal(hydrated.getDataUseAttestation(noUse.id).usageState, "no_use");
  assert.equal(hydrated.getDataUseAttestation(challenge.id).auditEvent.action, "CHALLENGE");
  assert.equal(hydrated.listDataUseAttestations(receipt.id).length, 3);
  assert.equal(hydrated.getDataUseEnforcementCase(enforcementCase.id).enforcementRoot, enforcementCase.enforcementRoot);
  assert.equal(hydrated.listDataUseEnforcementCases(challenge.id).length, 2);
  assert.equal(hydrated.getDataAccessRestriction(restriction.id).restrictionState, "remediation_hold");
  assert.equal(hydrated.getDataAccessRestriction(restoredRestriction.id).previousRestrictionId, restriction.id);
  assert.equal(hydrated.listDataAccessRestrictions(requestFact.id)[0]?.restrictionState, "restored");
  assert.equal(hydrated.getDataAccessAccountabilityPacket(historicalPacket.id).packetRoot, historicalPacket.packetRoot);
  assert.equal(hydrated.listDataAccessAccountabilityPackets(requestFact.id).length, 2);
  assert.equal(
    hydrated.getDataAccessAccountabilityVerification(historicalVerification.id).verificationRoot,
    historicalVerification.verificationRoot,
  );
  assert.equal(hydrated.listDataAccessAccountabilityVerifications(historicalPacket.id).length, 1);
  const hydratedDisclosure = hydrated.getDataAccessAccountabilityDisclosure(historicalDisclosure.id);
  assert.equal(hydratedDisclosure.disclosureRoot, historicalDisclosure.disclosureRoot);
  assert.equal(hydratedDisclosure.currentState, "stale");
  assert.deepEqual(hydratedDisclosure.currentIssues, ["lineage_stale"]);
  assert.equal(hydratedDisclosure.governanceState, "corrected");
  assert.equal(hydratedDisclosure.openChallengeCount, 0);
  assert.deepEqual(hydratedDisclosure.noticeIds, [correctionNotice.id]);
  assert.deepEqual(hydratedDisclosure.replacementDisclosureIds, [replacementDisclosure.id]);
  assert.equal(hydrated.getDataAccessAccountabilityDisclosure(replacementDisclosure.id).governanceState, "challenged");
  assert.equal(hydrated.getDataAccessAccountabilityDisclosureChallenge(replacementChallenge.id).disclosureId, replacementDisclosure.id);
  assert.equal(hydrated.getDataAccessAccountabilityDisclosureNotice(correctionNotice.id).noticeRoot, correctionNotice.noticeRoot);
  assert.equal(
    hydrated.getDataAccessAccountabilityDisclosureChallenge(historicalDisclosureChallenge.id).challengeRoot,
    historicalDisclosureChallenge.challengeRoot,
  );
  assert.equal(
    hydrated.getDataAccessAccountabilityDisclosureResolution(historicalCorrectionResolution.id).previousResolutionRoot,
    historicalEvidenceRequestResolution.resolutionRoot,
  );
  assert.deepEqual(
    hydrated.listDataAccessAccountabilityDisclosureResolutions(historicalDisclosureChallenge.id).map((entry) => entry.id),
    [historicalEvidenceRequestResolution.id, historicalCorrectionResolution.id],
  );

  assert.throws(
    () =>
      CanopyProofPartnerService.fromAuthoritySnapshot({
        ...snapshot,
        dataAccessDeliveryReceipts: [{ ...receipt, manifestHash: "0".repeat(64) }],
      }),
    /delivery hash lineage is invalid/,
  );
  assert.throws(
    () =>
      CanopyProofPartnerService.fromAuthoritySnapshot({
        ...snapshot,
        dataAccessDeliveryReceipts: [
          {
            ...receipt,
            auditEvent: { ...receipt.auditEvent, payloadHash: "0".repeat(64) },
          },
        ],
      }),
    /delivery hash lineage is invalid/,
  );
  assert.throws(
    () =>
      CanopyProofPartnerService.fromAuthoritySnapshot({
        ...snapshot,
        dataUseAttestations: [{ ...withinScope, usageRoot: "0".repeat(64) }, noUse, challenge],
      }),
    /data use attestation hash lineage is invalid/,
  );
  assert.throws(
    () =>
      CanopyProofPartnerService.fromAuthoritySnapshot({
        ...snapshot,
        dataUseEnforcementCases: snapshot.dataUseEnforcementCases.map((entry) =>
          entry.id === enforcementCase.id ? { ...entry, enforcementRoot: "0".repeat(64) } : entry,
        ),
      }),
    /data use enforcement case hash lineage is invalid/,
  );
  assert.throws(
    () =>
      CanopyProofPartnerService.fromAuthoritySnapshot({
        ...snapshot,
        dataUseEnforcementCases: snapshot.dataUseEnforcementCases.map((entry) =>
          entry.id === enforcementCase.id ? { ...entry, evidenceEventRoots: ["9".repeat(64)] } : entry,
        ),
      }),
    /retain every challenged attestation evidence root/,
  );
  assert.throws(
    () =>
      CanopyProofPartnerService.fromAuthoritySnapshot({
        ...snapshot,
        dataAccessRestrictions: snapshot.dataAccessRestrictions.map((entry) =>
          entry.id === restoredRestriction.id ? { ...entry, previousRestrictionRoot: "0".repeat(64) } : entry,
        ),
      }),
    /invalid predecessor/,
  );
  assert.throws(
    () =>
      CanopyProofPartnerService.fromAuthoritySnapshot({
        ...snapshot,
        dataAccessRestrictions: snapshot.dataAccessRestrictions.map((entry) =>
          entry.id === restriction.id ? { ...entry, restrictionRoot: "0".repeat(64) } : entry,
        ),
      }),
    /restriction hash lineage is invalid/,
  );
  assert.throws(
    () =>
      CanopyProofPartnerService.fromAuthoritySnapshot({
        ...snapshot,
        dataAccessAccountabilityPackets: snapshot.dataAccessAccountabilityPackets.map((entry) =>
          entry.id === historicalPacket.id
            ? { ...entry, counts: { ...entry.counts, totalRestrictionCount: 2 } }
            : entry,
        ),
      }),
    /omits or adds ledger lineage/,
  );
  assert.throws(
    () =>
      CanopyProofPartnerService.fromAuthoritySnapshot({
        ...snapshot,
        dataAccessAccountabilityPackets: snapshot.dataAccessAccountabilityPackets.map((entry) =>
          entry.id === historicalPacket.id ? { ...entry, packetRoot: "0".repeat(64) } : entry,
        ),
      }),
    /accountability packet hash lineage is invalid/,
  );
  assert.throws(
    () =>
      CanopyProofPartnerService.fromAuthoritySnapshot({
        ...snapshot,
        dataAccessAccountabilityVerifications: snapshot.dataAccessAccountabilityVerifications.map((entry) =>
          entry.id === historicalVerification.id ? { ...entry, valid: false, issues: ["lineage_stale"] } : entry,
        ),
      }),
    /accountability verification has invalid issue derivation/,
  );
  assert.throws(
    () =>
      CanopyProofPartnerService.fromAuthoritySnapshot({
        ...snapshot,
        dataAccessAccountabilityDisclosures: snapshot.dataAccessAccountabilityDisclosures.map((entry) =>
          entry.id === historicalDisclosure.id ? { ...entry, disclosureRoot: "0".repeat(64) } : entry,
        ),
      }),
    /accountability disclosure hash lineage is invalid/,
  );
  assert.throws(
    () =>
      CanopyProofPartnerService.fromAuthoritySnapshot({
        ...snapshot,
        dataAccessAccountabilityDisclosureChallenges: snapshot.dataAccessAccountabilityDisclosureChallenges.map((entry) =>
          entry.id === historicalDisclosureChallenge.id ? { ...entry, challengeRoot: "0".repeat(64) } : entry,
        ),
      }),
    /accountability disclosure challenge hash lineage is invalid/,
  );
  assert.throws(
    () =>
      CanopyProofPartnerService.fromAuthoritySnapshot({
        ...snapshot,
        dataAccessAccountabilityDisclosureResolutions: snapshot.dataAccessAccountabilityDisclosureResolutions.map(
          (entry) =>
            entry.id === historicalCorrectionResolution.id ? { ...entry, resolutionRoot: "0".repeat(64) } : entry,
        ),
      }),
    /accountability disclosure resolution hash lineage is invalid/,
  );
  assert.throws(
    () =>
      CanopyProofPartnerService.fromAuthoritySnapshot({
        ...snapshot,
        dataAccessAccountabilityDisclosureResolutions: snapshot.dataAccessAccountabilityDisclosureResolutions.map(
          (entry) =>
            entry.id === historicalCorrectionResolution.id
              ? { ...entry, previousResolutionRoot: "0".repeat(64) }
              : entry,
        ),
      }),
    /forked predecessor/,
  );
  assert.throws(
    () =>
      CanopyProofPartnerService.fromAuthoritySnapshot({
        ...snapshot,
        dataAccessAccountabilityDisclosureNotices: snapshot.dataAccessAccountabilityDisclosureNotices.map((entry) =>
          entry.id === correctionNotice.id ? { ...entry, noticeRoot: "0".repeat(64) } : entry,
        ),
      }),
    /accountability disclosure notice hash lineage is invalid/,
  );
});

test("CanopyProof durable trust registry requires a bounded idempotency key before database access", async () => {
  const service = new PrismaCanopyProofTrustRegistryService({} as PrismaClient);
  assert.deepEqual(service.getStatus(), {
    service: "canopyproof-trust-registry",
    storage: "postgresql",
    transactional: true,
    identityWritesDurable: true,
    organizationAuthorityWritesDurable: true,
    dataSharingAgreementWritesDurable: true,
    dataAccessRequestWritesDurable: true,
    dataAccessDeliveryReceiptWritesDurable: true,
    dataUseAttestationWritesDurable: true,
    dataUseEnforcementCaseWritesDurable: true,
    dataAccessRestrictionWritesDurable: true,
    dataAccessAccountabilityPacketWritesDurable: true,
    dataAccessAccountabilityVerificationWritesDurable: true,
    dataAccessAccountabilityDisclosureWritesDurable: true,
    dataAccessAccountabilityDisclosureChallengeWritesDurable: true,
    dataAccessAccountabilityDisclosureResolutionWritesDurable: true,
    dataAccessAccountabilityDisclosureNoticeWritesDurable: true,
    auditExportManifestWritesDurable: true,
    projectLifecycleWritesDurable: true,
    evidenceRegistrationWritesDurable: true,
    mobileEvidenceBindingWritesDurable: true,
    evidenceConsentReceiptWritesDurable: true,
    evidenceConsentRevocationWritesDurable: true,
    evidenceDeviceAttestationWritesDurable: true,
    evidenceMediaUploadIntentWritesDurable: true,
    evidenceMediaObjectWritesDurable: true,
    evidenceMediaDuplicateRelationWritesDurable: true,
    evidenceMediaScanResultWritesDurable: true,
    evidenceMediaProviderReceiptVerificationWritesDurable: true,
    evidenceMediaScannerReceiptVerificationWritesDurable: true,
    evidenceMediaAdapterRoutesMounted: false,
    evidenceMediaReviewTaskWritesDurable: true,
    evidenceMediaReviewAssignmentWritesDurable: true,
    evidenceMediaReviewDecisionWritesDurable: true,
    evidenceMediaCustodyEventWritesDurable: true,
    visualEvidenceAuthorityWritesDurable: true,
    evidenceVerificationWritesDurable: true,
    evidenceChallengeCorrectionWritesDurable: true,
    evidenceFinalDecisionWritesDurable: true,
    governedPolicyWritesDurable: true,
    methodologyVersionWritesDurable: true,
    methodologyPublicationWritesDurable: true,
    environmentalProofCandidateWritesDurable: true,
    environmentalProofApprovalWritesDurable: true,
    environmentalProofRecordWritesDurable: true,
    environmentalProofChallengeWritesDurable: true,
    environmentalProofChallengeRiskWritesDurable: true,
    environmentalProofChallengeReviewWritesDurable: true,
    environmentalProofChallengeResolutionWritesDurable: true,
    semanticAuditAppendOnly: true,
    databaseAuditEnabled: true,
    idempotencyRequired: true,
    privateKeyHandlingDisabled: true,
  });
  await assert.rejects(
    service.registerParticipant(
      {
        participantType: "human",
        displayName: "Missing idempotency key",
        roles: ["community"],
      },
      "owner_missing_idempotency",
      "short",
    ),
    (error: unknown) =>
      error instanceof CanopyProofTrustRegistryError &&
      error.code === "CANOPYPROOF_IDEMPOTENCY_REQUIRED" &&
      error.httpStatus === 400,
  );
});

test("CanopyProof durable trust commands lock command identity and semantic stream before state lookup", async () => {
  const statements: Array<{ sql: string; values: readonly unknown[] }> = [];
  const recordStatement = (query: unknown) => {
    const candidate = query as { sql?: unknown; values?: unknown };
    const sql = typeof candidate.sql === "string" ? candidate.sql : String(query);
    const values = Array.isArray(candidate.values) ? candidate.values : [];
    statements.push({ sql, values });
    return sql;
  };
  const transaction = {
    $queryRaw: async (query: unknown) => {
      const sql = recordStatement(query);
      if (sql.includes("FROM audit.command_receipts") || sql.includes("FROM identity.participants")) return [];
      return [{}];
    },
    $executeRaw: async (query: unknown) => {
      recordStatement(query);
      return 1;
    },
  };
  const prisma = {
    async $transaction<T>(operation: (client: typeof transaction) => Promise<T>) {
      return operation(transaction);
    },
  } as unknown as PrismaClient;
  const service = new PrismaCanopyProofTrustRegistryService(prisma);
  const rawIdempotencyKey = "native-lock-order-key";
  const participant = await service.registerParticipant(
    {
      id: "cp_identity_lock_order_001",
      participantType: "human",
      displayName: "Lock Order Participant",
      roles: ["community"],
      createdAt: "2026-07-11T00:00:00.000Z",
    },
    "owner_lock_order_001",
    rawIdempotencyKey,
  );
  assert.equal(participant.id, "cp_identity_lock_order_001");

  const commandLockIndex = statements.findIndex(
    (statement) => statement.sql.includes("pg_advisory_xact_lock") && statement.values.some((value) => String(value).startsWith("trust-command:")),
  );
  const receiptLookupIndex = statements.findIndex((statement) => statement.sql.includes("FROM audit.command_receipts"));
  const streamLockIndex = statements.findIndex(
    (statement) => statement.sql.includes("pg_advisory_xact_lock") && statement.values.includes("domain-event:cp_identity_lock_order_001"),
  );
  const stateLookupIndex = statements.findIndex((statement) => statement.sql.includes("FROM identity.participants"));
  assert.ok(commandLockIndex >= 0);
  assert.ok(receiptLookupIndex > commandLockIndex);
  assert.ok(streamLockIndex > receiptLookupIndex);
  assert.ok(stateLookupIndex > streamLockIndex);
  assert.equal(
    statements.some((statement) => statement.values.includes(rawIdempotencyKey)),
    false,
    "raw idempotency keys must not enter SQL parameters",
  );
});

test("CanopyProof trust registry status exposes configuration posture without database credentials", () => {
  const databaseUrlFixture =
    "postgresql://sensitive-user:" + "sensitive-password@db.internal/canopyproof";
  const configured = canopyProofTrustRegistryConfigurationStatus({
    NODE_ENV: "production",
    DROPIN_CANOPYPROOF_MODE: "production",
    DROPIN_REPOSITORY: "prisma",
    DATABASE_URL: databaseUrlFixture,
  });
  const missing = canopyProofTrustRegistryConfigurationStatus({
    NODE_ENV: "production",
    DROPIN_CANOPYPROOF_MODE: "production",
    DROPIN_REPOSITORY: "memory",
  });
  const developmentIsolation = canopyProofTrustRegistryConfigurationStatus({
    NODE_ENV: "development",
    DROPIN_CANOPYPROOF_AUTH_MODE: "development_headers",
    DROPIN_REPOSITORY: "prisma",
    DATABASE_URL: "postgresql://unused-in-development-isolation",
  });

  assert.equal(configured.mode, "postgresql");
  assert.equal(configured.configured, true);
  assert.equal(configured.pendingPartnerWorkflowAdapters, true);
  assert.equal(configured.dataSharingAgreementCommandsDurable, true);
  assert.equal(configured.dataAccessRequestCommandsDurable, true);
  assert.equal(configured.dataAccessDeliveryReceiptCommandsDurable, true);
  assert.equal(configured.dataUseAttestationCommandsDurable, true);
  assert.equal(configured.dataUseEnforcementCaseCommandsDurable, true);
  assert.equal(configured.dataAccessRestrictionCommandsDurable, true);
  assert.equal(configured.dataAccessAccountabilityPacketCommandsDurable, true);
  assert.equal(configured.dataAccessAccountabilityVerificationCommandsDurable, true);
  assert.equal(configured.dataAccessAccountabilityDisclosureCommandsDurable, true);
  assert.equal(configured.dataAccessAccountabilityDisclosureChallengeCommandsDurable, true);
  assert.equal(configured.dataAccessAccountabilityDisclosureResolutionCommandsDurable, true);
  assert.equal(configured.dataAccessAccountabilityDisclosureNoticeCommandsDurable, true);
  assert.equal(configured.auditExportManifestCommandsDurable, true);
  assert.equal(configured.projectLifecycleCommandsDurable, true);
  assert.equal(configured.evidenceRegistrationCommandsDurable, true);
  assert.equal(configured.evidenceConsentReceiptCommandsDurable, true);
  assert.equal(configured.evidenceConsentRevocationCommandsDurable, true);
  assert.equal(configured.evidenceDeviceAttestationCommandsDurable, true);
  assert.equal(configured.evidenceMediaUploadIntentCommandsDurable, true);
  assert.equal(configured.evidenceMediaObjectCommandsDurable, true);
  assert.equal(configured.evidenceMediaDuplicateRelationCommandsDurable, true);
  assert.equal(configured.evidenceMediaScanResultCommandsDurable, true);
  assert.equal(configured.evidenceMediaProviderReceiptVerificationCommandsDurable, true);
  assert.equal(configured.evidenceMediaScannerReceiptVerificationCommandsDurable, true);
  assert.equal(configured.evidenceMediaAdapterRoutesMounted, false);
  assert.equal(configured.evidenceMediaReviewTaskCommandsDurable, true);
  assert.equal(configured.evidenceMediaReviewAssignmentCommandsDurable, true);
  assert.equal(configured.evidenceMediaReviewDecisionCommandsDurable, true);
  assert.equal(configured.evidenceMediaCustodyEventCommandsDurable, true);
  assert.equal(configured.visualEvidenceAuthorityCommandsDurable, true);
  assert.equal(configured.evidenceVerificationCommandsDurable, true);
  assert.equal(configured.evidenceChallengeCorrectionCommandsDurable, true);
  assert.equal(configured.evidenceFinalDecisionCommandsDurable, true);
  assert.equal(configured.governedPolicyCommandsDurable, true);
  assert.equal(configured.methodologyVersionCommandsDurable, true);
  assert.equal(configured.methodologyPublicationCommandsDurable, true);
  assert.equal(configured.environmentalProofCandidateCommandsDurable, true);
  assert.equal(configured.environmentalProofApprovalCommandsDurable, true);
  assert.equal(configured.environmentalProofRecordCommandsDurable, true);
  assert.equal(configured.environmentalProofChallengeCommandsDurable, true);
  assert.equal(configured.environmentalProofChallengeReviewCommandsDurable, true);
  assert.equal(configured.environmentalProofChallengeResolutionCommandsDurable, true);
  assert.equal(configured.safety.noProductionMemoryFallback, true);
  assert.equal(missing.configured, false);
  assert.equal(developmentIsolation.mode, "development_memory");
  assert.equal(developmentIsolation.configured, true);
  assert.doesNotMatch(JSON.stringify(configured), /sensitive-user|sensitive-password|db\.internal/);
});

test("CanopyProof production persistence guard opens only durable agreement, access, accountability, and disclosure routes", () => {
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence("/canopyproof/organizations/cp_org/data-sharing-agreements"),
    false,
  );
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence("/canopyproof/data-sharing-agreements/cp_agreement/revocations"),
    false,
  );
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence("/canopyproof/data-sharing-agreements/cp_agreement/supersessions"),
    false,
  );
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence("/canopyproof/organizations/cp_org/data-access-requests"),
    false,
  );
  assert.equal(canopyProofRequiresPendingPartnerPersistence("/canopyproof/data-access-requests/cp_request"), false);
  assert.equal(canopyProofRequiresPendingPartnerPersistence("/canopyproof/data-access-requests/cp_request/deliveries"), false);
  assert.equal(canopyProofRequiresPendingPartnerPersistence("/canopyproof/data-access-deliveries/cp_delivery"), false);
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence("/canopyproof/data-access-deliveries/cp_delivery/use-attestations"),
    false,
  );
  assert.equal(canopyProofRequiresPendingPartnerPersistence("/canopyproof/data-use-attestations/cp_attestation"), false);
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence("/canopyproof/data-use-attestations/cp_attestation/enforcement-cases"),
    false,
  );
  assert.equal(canopyProofRequiresPendingPartnerPersistence("/canopyproof/data-use-enforcement-cases/cp_case"), false);
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence("/canopyproof/data-use-enforcement-cases/cp_case/access-restrictions"),
    false,
  );
  assert.equal(canopyProofRequiresPendingPartnerPersistence("/canopyproof/data-access-requests/cp_request/restrictions"), false);
  assert.equal(canopyProofRequiresPendingPartnerPersistence("/canopyproof/data-access-restrictions/cp_restriction"), false);
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence("/canopyproof/data-access-requests/cp_request/accountability-packets"),
    false,
  );
  assert.equal(canopyProofRequiresPendingPartnerPersistence("/canopyproof/data-access-accountability-packets/cp_packet"), false);
  assert.equal(canopyProofRequiresPendingPartnerPersistence("/canopyproof/data-access-accountability-packets/cp_packet/verify"), false);
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence("/canopyproof/data-access-accountability-packets/cp_packet/verifications"),
    false,
  );
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence("/canopyproof/data-access-accountability-verifications/cp_verification"),
    false,
  );
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence("/canopyproof/data-access-accountability-packets/cp_packet/disclosures"),
    false,
  );
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence("/canopyproof/public-accountability/data-access-disclosures"),
    false,
  );
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence("/canopyproof/public-accountability/data-access-disclosures/status"),
    false,
  );
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence("/canopyproof/public-accountability/data-access-disclosures/cp_disclosure"),
    false,
  );
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence(
      "/canopyproof/public-accountability/data-access-disclosures/cp_disclosure/challenges",
    ),
    false,
  );
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence(
      "/canopyproof/public-accountability/data-access-disclosure-challenges/cp_challenge",
    ),
    false,
  );
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence(
      "/canopyproof/public-accountability/data-access-disclosure-challenges/cp_challenge/resolutions",
    ),
    false,
  );
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence(
      "/canopyproof/public-accountability/data-access-disclosure-resolutions/cp_resolution",
    ),
    false,
  );
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence(
      "/canopyproof/public-accountability/data-access-disclosure-resolutions/cp_resolution/notices",
    ),
    false,
  );
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence(
      "/canopyproof/public-accountability/data-access-disclosures/cp_disclosure/notices",
    ),
    false,
  );
  assert.equal(
    canopyProofRequiresPendingPartnerPersistence(
      "/canopyproof/public-accountability/data-access-disclosure-notices/cp_notice",
    ),
    false,
  );
});

test("CanopyProof production evidence guard opens only durable registration and verification authority routes", () => {
  assert.equal(canopyProofLegacyEvidenceNetworkEnabled({}), false);
  assert.equal(
    canopyProofLegacyEvidenceNetworkEnabled({ CANOPYPROOF_LEGACY_EVIDENCE_NETWORK_ENABLED: "true" }),
    true,
  );
  assert.equal(
    canopyProofLegacyEvidenceNetworkEnabled({
      CANOPYPROOF_LEGACY_EVIDENCE_NETWORK_ENABLED: "true",
      DROPIN_CANOPYPROOF_MODE: "production",
    }),
    false,
  );
  assert.equal(
    canopyProofLegacyEvidenceNetworkEnabled({
      CANOPYPROOF_LEGACY_EVIDENCE_NETWORK_ENABLED: "true",
      NODE_ENV: "production",
    }),
    false,
  );
  assert.equal(canopyProofIsLegacyEvidenceNetworkRoute("/canopyproof/evidence/media/presign"), true);
  assert.equal(canopyProofIsLegacyEvidenceNetworkRoute("/canopyproof/evidence/cp_evidence_001/custody-events"), true);
  assert.equal(canopyProofIsLegacyEvidenceNetworkRoute("/canopyproof/evidence/cp_evidence_001/ai-analysis"), false);
  assert.equal(canopyProofIsLegacyEvidenceNetworkRoute("/canopyproof/evidence/cp_evidence_001/final-decisions"), false);
  assert.equal(canopyProofIsLegacyEvidenceNetworkRoute("/canopyproof/evidence/mobile-sync/bindings"), false);
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence"), false);
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/cp_evidence_001"), false);
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/status"), true);
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/media/presign"), true);
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/consent-receipts"), true);
  assert.equal(
    canopyProofRequiresPendingEvidencePersistence(
      "/canopyproof/evidence/consent-receipts/cp_consent_001/revoke",
    ),
    true,
  );
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/devices/attest"), true);
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/review-tasks"), true);
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/cp_evidence_001/ai-analysis"), true);
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/mobile-sync/status"), false);
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/mobile-sync/bindings"), false);
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/mobile-sync/batches"), false);
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/mobile-sync/recoveries"), false);
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/cp_evidence_001/validation-runs"), false);
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/cp_evidence_001/ai-analyses"), false);
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/cp_evidence_001/human-reviews"), false);
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/cp_evidence_001/challenges"), false);
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/cp_evidence_001/corrections"), false);
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/cp_evidence_001/reliance"), false);
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/cp_evidence_001/final-decisions"), false);
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/cp_evidence_001/final-verification"), false);
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/cp_evidence_001/custody-events"), true);
  assert.equal(
    canopyProofRequiresPendingEvidencePersistence("/canopyproof/evidence/cp_evidence_001/community-attestations"),
    true,
  );
  assert.equal(canopyProofRequiresPendingEvidencePersistence("/canopyproof/projects"), false);
  assert.equal(canopyProofRequiresPendingVerificationPersistence("/canopyproof/verification/validation-runs/cp_run"), false);
  assert.equal(canopyProofRequiresPendingVerificationPersistence("/canopyproof/verification/ai-analyses/cp_analysis"), false);
  assert.equal(canopyProofRequiresPendingVerificationPersistence("/canopyproof/verification/human-reviews/cp_review"), false);
  assert.equal(
    canopyProofRequiresPendingVerificationPersistence("/canopyproof/verification/evidence-challenges/cp_challenge"),
    false,
  );
  assert.equal(
    canopyProofRequiresPendingVerificationPersistence(
      "/canopyproof/verification/evidence-challenges/cp_challenge/resolutions",
    ),
    false,
  );
  assert.equal(
    canopyProofRequiresPendingVerificationPersistence(
      "/canopyproof/verification/evidence-challenge-resolutions/cp_resolution/corrections",
    ),
    false,
  );
  assert.equal(
    canopyProofRequiresPendingVerificationPersistence("/canopyproof/verification/evidence-corrections/cp_correction"),
    false,
  );
  assert.equal(
    canopyProofRequiresPendingVerificationPersistence(
      "/canopyproof/verification/evidence-final-decisions/cp_final_decision",
    ),
    false,
  );
  assert.equal(canopyProofRequiresPendingVerificationPersistence("/canopyproof/verification/queue/work-items"), true);
  assert.equal(canopyProofRequiresPendingVerificationPersistence("/canopyproof/verification/decisions"), true);
  assert.equal(canopyProofRequiresPendingVerificationPersistence("/canopyproof/verification/challenge-cases"), true);
  assert.equal(canopyProofRequiresPendingVerificationPersistence("/canopyproof/environmental-proof-candidates"), true);
  assert.equal(canopyProofRequiresPendingVerificationPersistence("/canopyproof/environmental-proof-challenges"), true);
  assert.equal(
    canopyProofRequiresPendingVerificationPersistence("/canopyproof/environmental-proof-records/cp_record/status"),
    true,
  );
  assert.equal(canopyProofRequiresPendingVerificationPersistence("/canopyproof/proof-records"), true);
  assert.equal(canopyProofRequiresPendingVerificationPersistence("/canopyproof/public-records"), true);
});

test("CanopyProof final-decision API rejects role substitution and has no memory fallback", async () => {
  for (const role of ["owner", "admin", "researcher", "agent", "observer"]) {
    const response = await app.request("/canopyproof/evidence/cp_evidence_final_api/final-decisions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dropin-actor-id": `cp_final_api_${role}`,
        "x-dropin-actor-role": role,
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 403, `${role} must not author an evidence final decision`);
  }

  const verifier = await app.request("/canopyproof/evidence/cp_evidence_final_api/final-decisions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dropin-actor-id": "cp_final_api_verifier",
      "x-dropin-actor-role": "verifier",
    },
    body: JSON.stringify({}),
  });
  assert.equal(verifier.status, 503);
  assert.match(await verifier.text(), /CANOPYPROOF_DURABLE_WRITE_UNAVAILABLE/);
});

test("CanopyProof production refuses pending partner governance instead of returning memory state", async () => {
  const environment = {
    NODE_ENV: "production",
    DROPIN_CANOPYPROOF_MODE: "production",
    DROPIN_CANOPYPROOF_AUTH_MODE: "cloudflare_access_jwt",
    DROPIN_ACCESS_TEAM_DOMAIN: "https://canopyproof.cloudflareaccess.com",
    DROPIN_ACCESS_AUD: "canopyproof-access-audience",
    DROPIN_REPOSITORY: "prisma",
    DATABASE_URL: "postgresql://configured-without-secret-material",
  } as const;
  const previous = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries(environment)) {
    previous.set(name, process.env[name]);
    process.env[name] = value;
  }
  try {
    const statusResponse = await app.request("/canopyproof/partners/status");
    const statusBody = (await statusResponse.json()) as {
      ok: true;
      data: {
        countsAuthoritative: boolean;
        trustRegistry: { mode: string; configured: boolean };
      };
    };
    assert.equal(statusResponse.status, 200);
    assert.equal(statusBody.data.countsAuthoritative, false);
    assert.equal(statusBody.data.trustRegistry.mode, "postgresql");
    assert.equal(statusBody.data.trustRegistry.configured, true);

    const response = await app.request(
      "/canopyproof/public-accountability/data-access-disclosures/cp_disclosure/appeals",
    );
    const body = (await response.json()) as { ok: false; error: string };
    assert.equal(response.status, 503);
    assert.equal(body.error, "CANOPYPROOF_DURABLE_WRITE_UNAVAILABLE");

    const proofCandidateResponse = await app.request(
      "/canopyproof/environmental-proof-candidates/cp_candidate_unopened",
    );
    const proofCandidateBody = (await proofCandidateResponse.json()) as { ok: false; error: string };
    assert.equal(proofCandidateResponse.status, 503);
    assert.equal(proofCandidateBody.error, "CANOPYPROOF_DURABLE_WRITE_UNAVAILABLE");

    const proofRecordResponse = await app.request(
      "/canopyproof/environmental-proof-records/cp_record_unopened/status",
    );
    const proofRecordBody = (await proofRecordResponse.json()) as { ok: false; error: string };
    assert.equal(proofRecordResponse.status, 503);
    assert.equal(proofRecordBody.error, "CANOPYPROOF_DURABLE_WRITE_UNAVAILABLE");
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
