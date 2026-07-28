import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  CanopyProofTrustRegistryError,
  PrismaCanopyProofTrustRegistryService,
} from "../../services/api/src/domain/canopyproof/trust-registry.js";
import { appendCanopyProofAuditEvent } from "../../services/api/src/domain/canopyproof/proof-engine.js";
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
import type {
  CanopyProofVerificationActorSnapshot,
} from "../../services/api/src/domain/canopyproof/evidence-verification-authority.js";

test("CanopyProof evidence verification, final decision, challenge, resolution, and correction persist as one append-only authority stream", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const contract = await readFile(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");
  const ownerId = "cp_pglite_verification_owner";
  const verifierId = "cp_pglite_verification_reviewer";
  const finalVerifierId = "cp_pglite_verification_final_verifier";
  const resolutionVerifierId = "cp_pglite_verification_resolution_reviewer";
  const correctionAdminId = "cp_pglite_verification_correction_admin";
  const agentId = "cp_pglite_verification_agent";
  const approverId = "cp_pglite_verification_project_approver";
  const organizationId = "cp_pglite_verification_org";
  const challengerOrganizationId = "cp_pglite_challenger_org";
  const challengerId = "cp_pglite_external_challenger";
  const projectId = "cp_pglite_verification_project";
  const methodologyAuthorId = "cp_pglite_environmental_proof_methodology_author";
  const methodologyVerifierId = "cp_pglite_environmental_proof_methodology_verifier";
  const methodologyResearcherId = "cp_pglite_environmental_proof_methodology_researcher";
  const proofIssuerId = "cp_pglite_environmental_proof_issuer";
  const proofChallengeVerifierId = "cp_pglite_environmental_proof_challenge_verifier";
  const proofChallengeAdminId = "cp_pglite_environmental_proof_challenge_admin";
  const proofChallengeResolverId = "cp_pglite_environmental_proof_challenge_resolver";

  try {
    await db.exec(contract);
    await db.exec(contract);
    for (const migration of [
      "evidence-device-attestation-adapters.sql",
      "evidence-offline-community.sql",
      "mrv-graph.sql",
      "environmental-proof-lifecycle.sql",
      "public-transparency-authority.sql",
      "public-transparency-explorer.sql",
      "esg-metric-authority.sql",
      "esg-reporting-authority.sql",
    ]) {
      await db.exec(await readFile(join(process.cwd(), "services/api/prisma", migration), "utf8"));
    }
    await db.exec(
      await readFile(
        join(process.cwd(), "services/api/prisma/environmental-proof-lifecycle.sql"),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        join(process.cwd(), "services/api/prisma/public-transparency-authority.sql"),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        join(process.cwd(), "services/api/prisma/public-transparency-explorer.sql"),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        join(process.cwd(), "services/api/prisma/esg-reporting-authority.sql"),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        join(process.cwd(), "services/api/prisma/esg-metric-authority.sql"),
        "utf8",
      ),
    );
    await assertTriggerCatalog(db, "verification.evidence_validation_runs", [
      "verification_evidence_validation_runs_audit",
      "verification_evidence_validation_runs_no_delete",
      "verification_evidence_validation_runs_no_update",
      "verification_evidence_validation_runs_validate",
    ]);
    await assertTriggerCatalog(db, "verification.evidence_ai_analyses", [
      "verification_evidence_ai_analyses_audit",
      "verification_evidence_ai_analyses_no_delete",
      "verification_evidence_ai_analyses_no_update",
      "verification_evidence_ai_analyses_validate",
    ]);
    await assertTriggerCatalog(db, "verification.evidence_human_reviews", [
      "verification_evidence_human_reviews_audit",
      "verification_evidence_human_reviews_no_delete",
      "verification_evidence_human_reviews_no_update",
      "verification_evidence_human_reviews_validate",
    ]);
    await assertTriggerCatalog(db, "verification.evidence_challenges", [
      "verification_evidence_challenges_audit",
      "verification_evidence_challenges_no_delete",
      "verification_evidence_challenges_no_update",
      "verification_evidence_challenges_validate",
    ]);
    await assertTriggerCatalog(db, "verification.evidence_challenge_resolutions", [
      "verification_evidence_challenge_resolutions_audit",
      "verification_evidence_challenge_resolutions_no_delete",
      "verification_evidence_challenge_resolutions_no_update",
      "verification_evidence_challenge_resolutions_validate",
    ]);
    await assertTriggerCatalog(db, "verification.evidence_corrections", [
      "verification_evidence_corrections_audit",
      "verification_evidence_corrections_no_delete",
      "verification_evidence_corrections_no_update",
      "verification_evidence_corrections_validate",
    ]);
    await assertTriggerCatalog(db, "verification.evidence_final_decisions", [
      "verification_evidence_final_decisions_audit",
      "verification_evidence_final_decisions_no_delete",
      "verification_evidence_final_decisions_no_update",
      "verification_evidence_final_decisions_validate",
    ]);
    await assertTriggerCatalog(db, "certificates.environmental_proof_candidates", [
      "environmental_proof_candidates_audit",
      "environmental_proof_candidates_no_delete",
      "environmental_proof_candidates_no_update",
      "environmental_proof_candidates_validate",
    ]);
    await assertTriggerCatalog(db, "governance.environmental_proof_candidate_approvals", [
      "environmental_proof_candidate_approvals_audit",
      "environmental_proof_candidate_approvals_no_delete",
      "environmental_proof_candidate_approvals_no_update",
      "environmental_proof_candidate_approvals_validate",
    ]);
    await assertTriggerCatalog(db, "certificates.environmental_proof_record_facts", [
      "environmental_proof_record_facts_audit",
      "environmental_proof_record_facts_no_delete",
      "environmental_proof_record_facts_no_update",
      "environmental_proof_record_facts_validate",
    ]);
    await assertTriggerCatalog(db, "certificates.environmental_proof_challenges", [
      "environmental_proof_challenges_audit",
      "environmental_proof_challenges_no_delete",
      "environmental_proof_challenges_no_update",
      "environmental_proof_challenges_validate",
    ]);
    await assertTriggerCatalog(db, "certificates.environmental_proof_challenge_risk_signals", [
      "environmental_proof_challenge_risk_signals_audit",
      "environmental_proof_challenge_risk_signals_no_delete",
      "environmental_proof_challenge_risk_signals_no_update",
      "environmental_proof_challenge_risk_signals_validate",
    ]);
    await assertTriggerCatalog(db, "governance.environmental_proof_challenge_reviews", [
      "environmental_proof_challenge_reviews_audit",
      "environmental_proof_challenge_reviews_no_delete",
      "environmental_proof_challenge_reviews_no_update",
      "environmental_proof_challenge_reviews_validate",
    ]);
    await assertTriggerCatalog(db, "governance.environmental_proof_challenge_resolutions", [
      "environmental_proof_challenge_resolutions_audit",
      "environmental_proof_challenge_resolutions_no_delete",
      "environmental_proof_challenge_resolutions_no_update",
      "environmental_proof_challenge_resolutions_validate",
    ]);

    await insertBootstrapOwner(db, ownerId);
    const service = new PrismaCanopyProofTrustRegistryService(pglitePrismaClient(db));
    const organization = await service.registerOrganization(
      {
        id: organizationId,
        name: "PGlite Evidence Verification Observatory",
        organizationType: "research_institution",
        jurisdiction: "GLOBAL",
        publicContact: "verification-observatory@example.org",
        operatingRegions: ["region_verification_authority"],
        verificationCapabilities: ["independent field evidence verification"],
        documents: [],
        authorizedUsers: [
          ownerId,
          verifierId,
          finalVerifierId,
          resolutionVerifierId,
          correctionAdminId,
          agentId,
          approverId,
          methodologyAuthorId,
          methodologyVerifierId,
          methodologyResearcherId,
          proofIssuerId,
          proofChallengeVerifierId,
          proofChallengeAdminId,
          proofChallengeResolverId,
        ],
        verificationStatus: "pending",
        trustLevel: "unverified",
        dataSharingPolicy: "restricted",
        createdAt: "2026-07-12T07:00:00.000Z",
      },
      ownerId,
      "verification-org-create",
    );
    await service.updateOrganizationVerification(
      organization.id,
      {
        verificationStatus: "verified",
        trustLevel: "verified",
        registrationNumber: "PGLITE-VERIFICATION-001",
        documents: [
          {
            documentType: "registration",
            documentHash: "1".repeat(64),
            issuedBy: "PGlite Institutional Registry",
            uploadedAt: "2026-07-12T07:00:10.000Z",
          },
        ],
        authorizedUsers: [
          ownerId,
          verifierId,
          finalVerifierId,
          resolutionVerifierId,
          correctionAdminId,
          agentId,
          approverId,
          methodologyAuthorId,
          methodologyVerifierId,
          methodologyResearcherId,
          proofIssuerId,
          proofChallengeVerifierId,
          proofChallengeAdminId,
          proofChallengeResolverId,
        ],
        rationale: "Organization verified before exercising evidence verification authority.",
        reviewedAt: "2026-07-12T07:00:10.000Z",
      },
      ownerId,
      "verification-org-verify",
    );
    await service.registerParticipant(
      {
        id: verifierId,
        participantType: "human",
        displayName: "PGlite Independent Evidence Verifier",
        organizationId,
        roles: ["verifier"],
        verificationStatus: "verified",
        credentialCommitments: ["2".repeat(64)],
        createdAt: "2026-07-12T07:00:20.000Z",
      },
      ownerId,
      "verification-reviewer-create",
    );
    await service.registerParticipant(
      {
        id: resolutionVerifierId,
        participantType: "human",
        displayName: "PGlite Independent Challenge Resolution Verifier",
        organizationId,
        roles: ["verifier"],
        verificationStatus: "verified",
        credentialCommitments: ["c".repeat(64)],
        createdAt: "2026-07-12T07:00:21.000Z",
      },
      ownerId,
      "verification-resolution-reviewer-create",
    );
    await service.registerParticipant(
      {
        id: finalVerifierId,
        participantType: "human",
        displayName: "PGlite Independent Final Evidence Verifier",
        organizationId,
        roles: ["verifier"],
        verificationStatus: "verified",
        credentialCommitments: ["ce".repeat(32)],
        createdAt: "2026-07-12T07:00:21.500Z",
      },
      ownerId,
      "verification-final-verifier-create",
    );
    await service.registerParticipant(
      {
        id: correctionAdminId,
        participantType: "human",
        displayName: "PGlite Independent Evidence Correction Administrator",
        organizationId,
        roles: ["admin"],
        verificationStatus: "verified",
        credentialCommitments: ["d".repeat(64)],
        createdAt: "2026-07-12T07:00:22.000Z",
      },
      ownerId,
      "verification-correction-admin-create",
    );
    await service.registerParticipant(
      {
        id: agentId,
        participantType: "agent",
        displayName: "PGlite Canopy AI Advisory Agent",
        organizationId,
        roles: ["agent"],
        verificationStatus: "verified",
        credentialCommitments: ["3".repeat(64)],
        createdAt: "2026-07-12T07:00:30.000Z",
      },
      ownerId,
      "verification-agent-create",
    );
    await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [ownerId]);
      await transaction.query(
        `INSERT INTO identity.agent_profiles (
          id, agent_type, layer, capabilities, allowed_actions,
          human_review_required, final_authority, status, registry_hash
        ) VALUES (
          $1, 'verification', 'Verification',
          ARRAY['managed_key_attestation_verification','detached_signature_verification']::text[],
          ARRAY['verify_managed_key_attestation','verify_detached_signature']::text[],
          true, false, 'active', $2
        )`,
        [agentId, hashJson({ kind: "lifecycle-pglite-managed-verifier-profile", agentId })],
      );
    });
    await service.registerParticipant(
      {
        id: approverId,
        participantType: "human",
        displayName: "PGlite Independent Project Governance Approver",
        roles: ["admin"],
        verificationStatus: "verified",
        credentialCommitments: ["4".repeat(64)],
        createdAt: "2026-07-12T07:00:40.000Z",
      },
      ownerId,
      "verification-project-approver-create",
    );
    await service.registerParticipant(
      {
        id: methodologyAuthorId,
        participantType: "human",
        displayName: "PGlite Environmental Proof Methodology Author",
        organizationId,
        roles: ["researcher"],
        verificationStatus: "verified",
        credentialCommitments: ["41".repeat(32)],
        createdAt: "2026-07-12T07:00:41.000Z",
      },
      ownerId,
      "environmental-proof-methodology-author-create",
    );
    await service.registerParticipant(
      {
        id: methodologyVerifierId,
        participantType: "human",
        displayName: "PGlite Environmental Proof Methodology Verifier",
        organizationId,
        roles: ["verifier"],
        verificationStatus: "verified",
        credentialCommitments: ["42".repeat(32)],
        createdAt: "2026-07-12T07:00:42.000Z",
      },
      ownerId,
      "environmental-proof-methodology-verifier-create",
    );
    await service.registerParticipant(
      {
        id: methodologyResearcherId,
        participantType: "human",
        displayName: "PGlite Environmental Proof Methodology Researcher",
        organizationId,
        roles: ["researcher"],
        verificationStatus: "verified",
        credentialCommitments: ["43".repeat(32)],
        createdAt: "2026-07-12T07:00:43.000Z",
      },
      ownerId,
      "environmental-proof-methodology-researcher-create",
    );
    await service.registerParticipant(
      {
        id: proofIssuerId,
        participantType: "human",
        displayName: "PGlite Independent Environmental Proof Issuer",
        organizationId,
        roles: ["admin"],
        verificationStatus: "verified",
        credentialCommitments: ["44".repeat(32)],
        createdAt: "2026-07-12T07:00:44.000Z",
      },
      ownerId,
      "environmental-proof-issuer-create",
    );
    await service.registerParticipant(
      {
        id: proofChallengeVerifierId,
        participantType: "human",
        displayName: "PGlite Independent Environmental Proof Challenge Verifier",
        organizationId,
        roles: ["verifier"],
        verificationStatus: "verified",
        credentialCommitments: ["45".repeat(32)],
        createdAt: "2026-07-12T07:00:45.000Z",
      },
      ownerId,
      "environmental-proof-challenge-verifier-create",
    );
    await service.registerParticipant(
      {
        id: proofChallengeAdminId,
        participantType: "human",
        displayName: "PGlite Independent Environmental Proof Challenge Administrator",
        organizationId,
        roles: ["admin"],
        verificationStatus: "verified",
        credentialCommitments: ["46".repeat(32)],
        createdAt: "2026-07-12T07:00:46.000Z",
      },
      ownerId,
      "environmental-proof-challenge-admin-create",
    );
    await service.registerParticipant(
      {
        id: proofChallengeResolverId,
        participantType: "human",
        displayName: "PGlite Independent Environmental Proof Challenge Resolver",
        organizationId,
        roles: ["admin"],
        verificationStatus: "verified",
        credentialCommitments: ["47".repeat(32)],
        createdAt: "2026-07-12T07:00:47.000Z",
      },
      ownerId,
      "environmental-proof-challenge-resolver-create",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: ownerId,
        role: "owner",
        conflictDisclosure: "Evidence contributor authority is separate from independent human review authority.",
        grantedAt: "2026-07-12T07:00:50.000Z",
      },
      ownerId,
      "verification-owner-membership",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: verifierId,
        role: "verifier",
        conflictDisclosure: "Verifier has no evidence authorship or AI execution conflict.",
        grantedAt: "2026-07-12T07:01:00.000Z",
      },
      ownerId,
      "verification-reviewer-membership",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: resolutionVerifierId,
        role: "verifier",
        conflictDisclosure: "Resolution verifier is independent from the contributor, AI agent, challenger, and original reviewer.",
        grantedAt: "2026-07-12T07:01:01.000Z",
      },
      ownerId,
      "verification-resolution-reviewer-membership",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: finalVerifierId,
        role: "verifier",
        conflictDisclosure: "Final verifier is independent from evidence authorship, AI execution, and first human review.",
        grantedAt: "2026-07-12T07:01:01.500Z",
      },
      ownerId,
      "verification-final-verifier-membership",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: correctionAdminId,
        role: "admin",
        conflictDisclosure: "Correction publisher is independent from evidence authorship and challenge adjudication.",
        grantedAt: "2026-07-12T07:01:02.000Z",
      },
      ownerId,
      "verification-correction-admin-membership",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: methodologyAuthorId,
        role: "researcher",
        conflictDisclosure: "Technical author remains separate from publication review, proof approval, and record issuance.",
        grantedAt: "2026-07-12T07:01:03.000Z",
      },
      ownerId,
      "environmental-proof-methodology-author-membership",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: methodologyVerifierId,
        role: "verifier",
        conflictDisclosure: "Methodology verifier is independent from the technical author, publisher, and proof reviewers.",
        grantedAt: "2026-07-12T07:01:04.000Z",
      },
      ownerId,
      "environmental-proof-methodology-verifier-membership",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: methodologyResearcherId,
        role: "researcher",
        conflictDisclosure: "Research reviewer is independent from methodology authorship, publication, and proof issuance.",
        grantedAt: "2026-07-12T07:01:05.000Z",
      },
      ownerId,
      "environmental-proof-methodology-researcher-membership",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: approverId,
        role: "admin",
        conflictDisclosure: "Proof policy approver is separate from evidence collection, review, monitoring, and issuance.",
        grantedAt: "2026-07-12T07:01:06.000Z",
      },
      ownerId,
      "environmental-proof-admin-approver-membership",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: proofIssuerId,
        role: "admin",
        conflictDisclosure: "Record issuer is separate from every source actor and candidate approver.",
        grantedAt: "2026-07-12T07:01:07.000Z",
      },
      ownerId,
      "environmental-proof-issuer-membership",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: proofChallengeVerifierId,
        role: "verifier",
        conflictDisclosure: "Challenge verifier is separate from every source, issuer, approver, challenger, and resolver.",
        grantedAt: "2026-07-12T07:01:08.000Z",
      },
      ownerId,
      "environmental-proof-challenge-verifier-membership",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: proofChallengeAdminId,
        role: "admin",
        conflictDisclosure: "Challenge administrator is separate from every source, issuer, approver, challenger, and resolver.",
        grantedAt: "2026-07-12T07:01:08.500Z",
      },
      ownerId,
      "environmental-proof-challenge-admin-membership",
    );
    await service.grantMembership(
      organizationId,
      {
        actorId: proofChallengeResolverId,
        role: "admin",
        conflictDisclosure: "Challenge resolver is separate from every source, issuer, approver, challenger, and reviewer.",
        grantedAt: "2026-07-12T07:01:09.000Z",
      },
      ownerId,
      "environmental-proof-challenge-resolver-membership",
    );
    await service.recordAccreditation(
      organizationId,
      {
        status: "approved",
        scope: ["field evidence verification"],
        rationale: "Independent institutional accreditation approved for bounded field evidence review.",
        evidenceHash: "5".repeat(64),
        decidedAt: "2026-07-12T07:01:10.000Z",
      },
      ownerId,
      "verification-accreditation",
    );
    const challengerOrganization = await service.registerOrganization(
      {
        id: challengerOrganizationId,
        name: "PGlite External Evidence Challenge Observatory",
        organizationType: "ngo",
        jurisdiction: "GLOBAL",
        publicContact: "external-challenge-observatory@example.org",
        operatingRegions: ["region_verification_authority"],
        verificationCapabilities: ["independent evidence challenge"],
        documents: [],
        authorizedUsers: [ownerId, challengerId],
        verificationStatus: "pending",
        trustLevel: "unverified",
        dataSharingPolicy: "restricted",
        createdAt: "2026-07-12T07:01:11.000Z",
      },
      ownerId,
      "external-challenger-org-create",
    );
    await service.updateOrganizationVerification(
      challengerOrganization.id,
      {
        verificationStatus: "verified",
        trustLevel: "verified",
        registrationNumber: "PGLITE-CHALLENGER-001",
        documents: [
          {
            documentType: "registration",
            documentHash: "6a".repeat(32),
            issuedBy: "PGlite External Institutional Registry",
            uploadedAt: "2026-07-12T07:01:12.000Z",
          },
        ],
        authorizedUsers: [ownerId, challengerId],
        rationale: "External challenger organization verified without receiving target evidence authority.",
        reviewedAt: "2026-07-12T07:01:12.000Z",
      },
      ownerId,
      "external-challenger-org-verify",
    );
    await service.registerParticipant(
      {
        id: challengerId,
        participantType: "human",
        displayName: "PGlite External Evidence Challenger",
        organizationId: challengerOrganizationId,
        roles: ["researcher"],
        verificationStatus: "verified",
        credentialCommitments: ["6b".repeat(32)],
        createdAt: "2026-07-12T07:01:13.000Z",
      },
      ownerId,
      "external-challenger-create",
    );
    await service.grantMembership(
      challengerOrganizationId,
      {
        actorId: challengerId,
        role: "researcher",
        conflictDisclosure: "External challenger has no target-organization membership or private evidence access.",
        grantedAt: "2026-07-12T07:01:14.000Z",
      },
      ownerId,
      "external-challenger-membership",
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
          "cp_pglite_verification_project_policy",
          "Independent verification project activation policy",
          hashJson({ kind: "pglite-verification-project-policy-v1" }),
          "2026-07-12T07:01:20.000Z",
        ],
      );
    });
    const project = await service.registerProject(
      {
        id: projectId,
        organizationId,
        title: "Institutional evidence verification field registry",
        projectType: "ecosystem_restoration",
        regionId: "region_verification_authority",
        location: {
          latitude: 14.7167,
          longitude: -17.4677,
          areaHectares: 25,
          boundaryHash: "6".repeat(64),
        },
        targetTreeCount: 10_000,
        biodiversityIndicators: ["native species mix"],
        waterIndicators: ["soil moisture recovery"],
        climateRiskIndicators: ["drought exposure"],
        monitoringCadenceDays: 60,
        governancePolicyId: "cp_pglite_verification_project_policy",
        createdAt: "2026-07-12T07:02:00.000Z",
      },
      ownerId,
      "owner",
      "verification-project-create",
    );
    await service.updateProjectStatus(
      project.id,
      {
        status: "under_review",
        rationale: "Independent review opened before project activation and evidence collection.",
        updatedAt: "2026-07-12T07:02:10.000Z",
      },
      verifierId,
      "verifier",
      "verification-project-review",
    );
    await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [approverId]);
      await transaction.query(
        `INSERT INTO governance.approvals (
          id, subject_type, subject_id, policy_id, approver_id, approver_role,
          decision, rationale, conflict_disclosure, approval_hash, decided_at
        ) VALUES ($1, 'project', $2, $3, $4, 'admin', 'approve', $5, $6, $7, $8)`,
        [
          "cp_pglite_verification_project_approval",
          project.id,
          "cp_pglite_verification_project_policy",
          approverId,
          "Independent human governance review approved bounded project activation.",
          "Approver is neither project creator nor evidence lifecycle reviewer.",
          hashJson({ kind: "pglite-verification-project-approval-v1", projectId: project.id }),
          "2026-07-12T07:02:20.000Z",
        ],
      );
    });
    await service.updateProjectStatus(
      project.id,
      {
        status: "active",
        governanceApprovalId: "cp_pglite_verification_project_approval",
        rationale: "Activate only after the independent governance approval was durably recorded.",
        updatedAt: "2026-07-12T07:02:30.000Z",
      },
      verifierId,
      "verifier",
      "verification-project-activate",
    );
    const registrationResult = await service.registerEvidence(
      {
        id: "cp_pglite_verification_evidence",
        projectId: project.id,
        evidenceType: "restoration",
        location: {
          latitude: 14.7167,
          longitude: -17.4677,
          accuracyMeters: 8,
          regionId: "region_verification_authority",
        },
        timestamp: "2026-07-12T07:03:00.000Z",
        createdAt: "2026-07-12T07:03:00.000Z",
        media_hash: "7".repeat(64),
        gps_hash: "8".repeat(64),
        confidence_score: 92,
      },
      ownerId,
      "owner",
      "verification-evidence-register",
    );
    const registration = registrationResult.evidence;

    const validationInput = {
      rulesetId: "canopyproof-evidence-validation-core",
      rulesetVersion: "1.0.0",
      executedAt: "2026-07-12T07:04:00.000Z",
    } as const;
    const validation = await service.runEvidenceValidation(
      registration.id,
      validationInput,
      agentId,
      "agent",
      "verification-run",
    );
    assert.equal(validation.outcome, "pass");
    assert.equal(validation.evidenceSequence, 2);
    assert.equal(
      (
        await service.runEvidenceValidation(
          registration.id,
          validationInput,
          agentId,
          "agent",
          "verification-run",
        )
      ).validationRoot,
      validation.validationRoot,
    );
    await assert.rejects(
      service.runEvidenceValidation(
        registration.id,
        { ...validationInput, executedAt: "2026-07-12T07:04:01.000Z" },
        agentId,
        "agent",
        "verification-run",
      ),
      (error: unknown) => error instanceof CanopyProofTrustRegistryError && error.httpStatus === 409,
    );

    const analysisInput = {
      validationRunId: validation.id,
      modelProvider: "CanopyProof Research",
      modelName: "Canopy AI Advisory",
      modelVersion: "1.0.0",
      modelArtifactHash: "9".repeat(64),
      promptHash: "a".repeat(64),
      datasetSnapshotRoots: ["b".repeat(64)],
      sourceEventRoots: [registration.audit_history[0].eventRoot, validation.auditEvent.eventRoot].sort(),
      executionEnvironment: "isolated-cpu-evaluation-v1",
      findings: [],
      confidenceScore: 88,
      analyzedAt: "2026-07-12T07:05:00.000Z",
    } as const;
    const analysis = await service.recordEvidenceAiAnalysis(
      registration.id,
      analysisInput,
      agentId,
      "verification-ai-analysis",
    );
    assert.equal(analysis.advisoryOnly, true);
    assert.equal(analysis.recommendation, "needs_human_review");
    assert.equal(analysis.evidenceSequence, 3);
    assert.equal((await service.getEvidenceReliance(registration.id, organizationId)).state, "ai_advised");

    const reviewInput = {
      validationRunId: validation.id,
      aiAnalysisIds: [analysis.id],
      decision: "approve",
      findingDispositions: [],
      rationale: "Independent accredited verifier approves bounded reliance on this evidence registration.",
      limitations: ["Reliance remains limited to this immutable evidence registration."],
      reviewedAt: "2026-07-12T07:06:00.000Z",
    } as const;
    const review = await service.recordEvidenceHumanReview(
      registration.id,
      reviewInput,
      verifierId,
      "verifier",
      "verification-human-review",
    );
    assert.equal(review.decision, "approve");
    assert.equal(review.evidenceSequence, 4);
    assert.equal((await service.getEvidenceReliance(registration.id, organizationId)).state, "approved");
    assert.equal((await service.listEvidenceValidationRuns(registration.id, organizationId)).length, 1);
    assert.equal((await service.listEvidenceAiAnalyses(registration.id, organizationId)).length, 1);
    assert.equal((await service.listEvidenceHumanReviews(registration.id, organizationId)).length, 1);
    assert.equal((await service.getEvidenceValidationRun(validation.id, organizationId)).validationRoot, validation.validationRoot);
    assert.equal((await service.getEvidenceAiAnalysis(analysis.id, organizationId)).analysisRoot, analysis.analysisRoot);
    assert.equal((await service.getEvidenceHumanReview(review.id, organizationId)).reviewRoot, review.reviewRoot);

    const finalDecisionInput = {
      decision: "verify",
      rationale: "A second independent accredited verifier confirms the exact current bounded evidence authority chain.",
      limitations: ["This internal final decision is not an environmental proof record and carries no transferable value."],
      sourceEventRoots: [
        registration.audit_history[0].eventRoot,
        validation.auditEvent.eventRoot,
        analysis.auditEvent.eventRoot,
        review.auditEvent.eventRoot,
      ].sort(),
      decidedAt: "2026-07-12T07:06:30.000Z",
    } as const;
    const finalDecision = await service.recordEvidenceFinalDecision(
      registration.id,
      finalDecisionInput,
      finalVerifierId,
      "verification-final-decision",
    );
    assert.equal(finalDecision.decision, "verify");
    assert.equal(finalDecision.evidenceSequence, 5);
    const verifiedProjection = await service.getEvidenceFinalVerification(registration.id, organizationId);
    assert.equal(verifiedProjection.state, "verified");
    assert.equal((await service.listEvidenceFinalDecisions(registration.id, organizationId)).length, 1);
    assert.equal(
      (await service.getEvidenceFinalDecision(finalDecision.id, organizationId)).decisionRoot,
      finalDecision.decisionRoot,
    );
    await assertDatabaseFinalVerification(
      db,
      registration.id,
      "verified",
      finalDecision.decisionRoot,
      verifiedProjection.finalVerificationRoot,
    );

    const methodologyPolicy = await service.createGovernedPolicy(
      {
        subject: "methodology_publication",
        title: "Independent Environmental Proof methodology publication policy",
        requiredApprovals: 2,
        allowedReviewerRoles: ["researcher", "verifier"],
        createdAt: "2026-07-12T07:06:31.000Z",
      },
      organizationId,
      ownerId,
      "owner",
      "environmental-proof-methodology-policy",
    );
    const proofPolicy = await service.createGovernedPolicy(
      {
        subject: "environmental_proof_record",
        title: "Independent Environmental Proof candidate and issuance policy",
        requiredApprovals: 2,
        allowedReviewerRoles: ["admin", "owner", "verifier"],
        createdAt: "2026-07-12T07:06:32.000Z",
      },
      organizationId,
      ownerId,
      "owner",
      "environmental-proof-record-policy",
    );
    const methodology = await service.createMethodologyVersion(
      {
        id: "cp_pglite_environmental_proof_methodology_v1",
        slug: "pglite-environmental-proof-methodology",
        version: "v1.0.0",
        title: "PGlite Environmental Proof Technical Methodology",
        scope: "multi_scope",
        status: "draft",
        summary: "Technical methodology binding final evidence decisions, accepted monitoring, and independent governance.",
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
        limitations: ["This technical methodology has no carbon, tax, token, funding, title, or financial authority."],
        createdAt: "2026-07-12T07:06:33.000Z",
      },
      methodologyAuthorId,
      "researcher",
      "environmental-proof-methodology-create",
    );
    const methodologyVerifierApproval = await service.approveMethodologyPublication(
      methodology.id,
      {
        decision: "approve",
        rationale: "Independent accredited verifier approves the exact methodology and publication policy authority roots.",
        conflictDisclosure: "No authorship, operational, financial, employment, familial, or issuer conflict is known.",
        limitations: ["Approval is bounded to this immutable methodology version."],
        sourceEventRoots: [methodology.auditEvent.eventRoot, methodologyPolicy.auditEvent.eventRoot],
        decidedAt: "2026-07-12T07:06:34.000Z",
      },
      organizationId,
      methodologyVerifierId,
      "verifier",
      "environmental-proof-methodology-verifier-approval",
    );
    const methodologyResearcherApproval = await service.approveMethodologyPublication(
      methodology.id,
      {
        decision: "approve",
        rationale: "Independent research reviewer approves publication after binding the accredited verifier decision.",
        conflictDisclosure: "No authorship, operational, financial, employment, familial, or issuer conflict is known.",
        limitations: ["Research approval grants no credit, tax, token, funding, title, or financial authority."],
        sourceEventRoots: [
          methodology.auditEvent.eventRoot,
          methodologyPolicy.auditEvent.eventRoot,
          methodologyVerifierApproval.auditEvent.eventRoot,
        ],
        decidedAt: "2026-07-12T07:06:35.000Z",
      },
      organizationId,
      methodologyResearcherId,
      "researcher",
      "environmental-proof-methodology-researcher-approval",
    );
    const publication = await service.publishMethodology(
      methodology.id,
      {
        approvalIds: [methodologyResearcherApproval.id, methodologyVerifierApproval.id],
        rationale: "Independent publisher records the complete methodology quorum and immutable source graph.",
        limitations: ["Publication remains subject to supersession, challenge, and continuing governance review."],
        sourceEventRoots: [
          methodology.auditEvent.eventRoot,
          methodologyPolicy.auditEvent.eventRoot,
          methodologyVerifierApproval.auditEvent.eventRoot,
          methodologyResearcherApproval.auditEvent.eventRoot,
        ],
        publishedAt: "2026-07-12T07:06:36.000Z",
      },
      organizationId,
      correctionAdminId,
      "admin",
      "environmental-proof-methodology-publish",
    );
    const monitoring = await service.recordProjectMonitoringEvent(
      project.id,
      {
        eventType: "field_observation",
        observedAt: "2026-07-12T07:06:40.000Z",
        evidenceIds: [registration.id],
        terraSceneIds: [],
        biodiversityIndicators: ["native species mix observed"],
        waterIndicators: ["soil moisture recovery observed"],
        climateRiskIndicators: ["drought exposure monitored"],
        metrics: { survivalRate: 0.93 },
        state: "accepted",
        rationale: "Accepted field monitoring postdates the independent final evidence decision and covers the evidence.",
      },
      methodologyResearcherId,
      "researcher",
      "environmental-proof-monitoring",
    );
    const candidateInput = {
      projectId: project.id,
      methodologyId: methodology.id,
      policyId: proofPolicy.id,
      evidenceIds: [registration.id],
      monitoringEventIds: [monitoring.id],
      derivedAt: "2026-07-12T07:06:50.000Z",
    } as const;
    const candidate = await service.deriveEnvironmentalProofCandidate(
      candidateInput,
      organizationId,
      methodologyAuthorId,
      "researcher",
      "environmental-proof-candidate",
    );
    assert.equal(candidate.methodologyPublicationId, publication.id);
    assert.deepEqual(candidate.evidenceFinalDecisionIds, [finalDecision.id]);
    assert.deepEqual(candidate.monitoringEventIds, [monitoring.id]);
    assert.equal(candidate.confidenceScore, 88);
    assert.equal(
      (
        await service.deriveEnvironmentalProofCandidate(
          candidateInput,
          organizationId,
          methodologyAuthorId,
          "researcher",
          "environmental-proof-candidate",
        )
      ).candidateRoot,
      candidate.candidateRoot,
    );
    const candidateParity = await db.query<{
      source_root: string;
      authority_root: string;
      command_hash: string;
      candidate_hash: string;
      candidate_root: string;
      payload_hash: string;
    }>(
      `SELECT
         certificates.environmental_proof_candidate_source_root(candidate) AS source_root,
         certificates.environmental_proof_candidate_authority_root(candidate) AS authority_root,
         certificates.environmental_proof_candidate_command_hash(candidate) AS command_hash,
         certificates.environmental_proof_candidate_hash(candidate) AS candidate_hash,
         certificates.environmental_proof_candidate_root(candidate) AS candidate_root,
         certificates.environmental_proof_candidate_payload_hash(candidate) AS payload_hash
       FROM certificates.environmental_proof_candidates candidate
       WHERE id = $1`,
      [candidate.id],
    );
    assert.equal(candidateParity.rows[0]?.source_root, candidate.sourceRoot);
    assert.equal(candidateParity.rows[0]?.authority_root, candidate.authorityRoot);
    assert.equal(candidateParity.rows[0]?.command_hash, candidate.commandHash);
    assert.equal(candidateParity.rows[0]?.candidate_hash, candidate.candidateHash);
    assert.equal(candidateParity.rows[0]?.candidate_root, candidate.candidateRoot);
    assert.equal(candidateParity.rows[0]?.payload_hash, candidate.auditEvent.payloadHash);

    const proofVerifierApproval = await service.approveEnvironmentalProofCandidate(
      candidate.id,
      {
        decision: "approve",
        rationale: "Independent accredited verifier approves the exact current Environmental Proof candidate authority.",
        conflictDisclosure: "No source, derivation, monitoring, authorship, financial, employment, familial, or issuer conflict is known.",
        limitations: ["Approval is limited to this immutable candidate root."],
        sourceEventRoots: [candidate.auditEvent.eventRoot],
        decidedAt: "2026-07-12T07:06:52.000Z",
      },
      organizationId,
      resolutionVerifierId,
      "verifier",
      "environmental-proof-verifier-approval",
    );
    assert.equal(
      (
        await service.approveEnvironmentalProofCandidate(
          candidate.id,
          {
            decision: "approve",
            rationale: "Independent accredited verifier approves the exact current Environmental Proof candidate authority.",
            conflictDisclosure: "No source, derivation, monitoring, authorship, financial, employment, familial, or issuer conflict is known.",
            limitations: ["Approval is limited to this immutable candidate root."],
            sourceEventRoots: [candidate.auditEvent.eventRoot],
            decidedAt: "2026-07-12T07:06:52.000Z",
          },
          organizationId,
          resolutionVerifierId,
          "verifier",
          "environmental-proof-verifier-approval",
        )
      ).approvalRoot,
      proofVerifierApproval.approvalRoot,
    );
    await assert.rejects(
      service.approveEnvironmentalProofCandidate(
        candidate.id,
        {
          decision: "approve",
          rationale: "A project source actor must not be able to approve the candidate derived from that authority.",
          conflictDisclosure: "The actor is deliberately disclosed as a project creator and evidence contributor source.",
          limitations: ["This attempted approval must be rejected."],
          sourceEventRoots: [candidate.auditEvent.eventRoot, proofVerifierApproval.auditEvent.eventRoot],
          decidedAt: "2026-07-12T07:06:53.000Z",
        },
        organizationId,
        ownerId,
        "owner",
        "environmental-proof-source-actor-denied",
      ),
      /independent human approver/,
    );
    await assert.rejects(
      service.issueEnvironmentalProofRecord(
        candidate.id,
        {
          approvalIds: ["cp_missing_environmental_proof_approval", proofVerifierApproval.id],
          rationale: "Issuance must fail before the complete verifier plus owner or administrator quorum exists.",
          limitations: ["This incomplete issuance attempt must be rejected."],
          sourceEventRoots: [candidate.auditEvent.eventRoot, proofVerifierApproval.auditEvent.eventRoot],
          issuedAt: "2026-07-12T07:06:53.500Z",
        },
        organizationId,
        proofIssuerId,
        "admin",
        "environmental-proof-incomplete-quorum-denied",
      ),
      /complete candidate approval set|quorum is incomplete/,
    );
    const proofAdminApproval = await service.approveEnvironmentalProofCandidate(
      candidate.id,
      {
        decision: "approve",
        rationale: "Independent administrator approves after binding the prior accredited verifier decision and candidate root.",
        conflictDisclosure: "No source, derivation, monitoring, authorship, financial, employment, familial, or issuer conflict is known.",
        limitations: ["Administrative approval grants no credit, tax, token, funding, title, or financial authority."],
        sourceEventRoots: [candidate.auditEvent.eventRoot, proofVerifierApproval.auditEvent.eventRoot],
        decidedAt: "2026-07-12T07:06:54.000Z",
      },
      organizationId,
      approverId,
      "admin",
      "environmental-proof-admin-approval",
    );
    const proofApprovalParity = await db.query<{
      command_hash: string;
      source_root: string;
      approval_hash: string;
      approval_root: string;
      payload_hash: string;
    }>(
      `SELECT
         governance.environmental_proof_approval_command_hash(approval) AS command_hash,
         governance.environmental_proof_approval_source_root(approval) AS source_root,
         governance.environmental_proof_approval_hash(approval) AS approval_hash,
         governance.environmental_proof_approval_root(approval) AS approval_root,
         governance.environmental_proof_approval_payload_hash(approval) AS payload_hash
       FROM governance.environmental_proof_candidate_approvals approval
       WHERE id = $1`,
      [proofVerifierApproval.id],
    );
    assert.equal(proofApprovalParity.rows[0]?.command_hash, proofVerifierApproval.commandHash);
    assert.equal(proofApprovalParity.rows[0]?.source_root, proofVerifierApproval.sourceRoot);
    assert.equal(proofApprovalParity.rows[0]?.approval_hash, proofVerifierApproval.approvalHash);
    assert.equal(proofApprovalParity.rows[0]?.approval_root, proofVerifierApproval.approvalRoot);
    assert.equal(proofApprovalParity.rows[0]?.payload_hash, proofVerifierApproval.auditEvent.payloadHash);
    await service.recordAccreditation(
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
        rationale: "Independent institutional accreditation enables the route-closed MRV and lifecycle conformance test.",
        evidenceHash: hashJson({ kind: "lifecycle-pglite-accreditation-evidence" }),
        decidedAt: "2026-07-12T07:06:55.000Z",
      },
      ownerId,
      "environmental-proof-lifecycle-accreditation",
    );
    const recordInput = {
      approvalIds: [proofAdminApproval.id, proofVerifierApproval.id],
      rationale: "Independent issuer records the complete current source authority and human governance quorum.",
      limitations: ["This Environmental Proof Record is an accountability statement only and carries no transferable value."],
      sourceEventRoots: [
        candidate.auditEvent.eventRoot,
        proofVerifierApproval.auditEvent.eventRoot,
        proofAdminApproval.auditEvent.eventRoot,
      ],
      issuedAt: "2026-07-12T07:06:56.000Z",
    } as const;
    const record = await service.issueEnvironmentalProofRecord(
      candidate.id,
      recordInput,
      organizationId,
      proofIssuerId,
      "admin",
      "environmental-proof-record-issue",
    );
    assert.equal(record.status, "issued");
    assert.equal(record.candidateRoot, candidate.candidateRoot);
    assert.equal((await service.listEnvironmentalProofApprovals(candidate.id, organizationId)).length, 2);
    assert.deepEqual(await service.getEnvironmentalProofRecord(record.id, organizationId), record);
    const recordParity = await db.query<{
      command_hash: string;
      source_root: string;
      record_hash: string;
      record_root: string;
      payload_hash: string;
    }>(
      `SELECT
         certificates.environmental_proof_record_command_hash(record_fact) AS command_hash,
         certificates.environmental_proof_record_source_root(record_fact) AS source_root,
         certificates.environmental_proof_record_hash(record_fact) AS record_hash,
         certificates.environmental_proof_record_root(record_fact) AS record_root,
         certificates.environmental_proof_record_payload_hash(record_fact) AS payload_hash
       FROM certificates.environmental_proof_record_facts record_fact
       WHERE id = $1`,
      [record.id],
    );
    assert.equal(recordParity.rows[0]?.command_hash, record.commandHash);
    assert.equal(recordParity.rows[0]?.source_root, record.sourceRoot);
    assert.equal(recordParity.rows[0]?.record_hash, record.recordHash);
    assert.equal(recordParity.rows[0]?.record_root, record.recordRoot);
    assert.equal(recordParity.rows[0]?.payload_hash, record.auditEvent.payloadHash);
    const issuedRecordProjection = await service.getEnvironmentalProofRecordStatus(record.id, organizationId);
    assert.equal(issuedRecordProjection.state, "issued");
    const issuedDatabaseProjection = await db.query<{
      state: string;
      source_authority_current: boolean;
      projection_root: string;
    }>(
      `SELECT state, source_authority_current, projection_root
       FROM certificates.environmental_proof_governed_record_projection($1)`,
      [record.id],
    );
    assert.equal(issuedDatabaseProjection.rows[0]?.state, "issued");
    assert.equal(issuedDatabaseProjection.rows[0]?.source_authority_current, true);
    assert.equal(issuedDatabaseProjection.rows[0]?.projection_root, issuedRecordProjection.projectionRoot);
    const reconnect = new PrismaCanopyProofTrustRegistryService(pglitePrismaClient(db));
    assert.deepEqual(await reconnect.getEnvironmentalProofCandidate(candidate.id, organizationId), candidate);
    assert.deepEqual(await reconnect.getEnvironmentalProofRecord(record.id, organizationId), record);
    assert.equal(
      (
        await reconnect.issueEnvironmentalProofRecord(
          candidate.id,
          recordInput,
          organizationId,
          proofIssuerId,
          "admin",
          "environmental-proof-record-issue",
        )
      ).recordRoot,
      record.recordRoot,
    );

    const mrvRepository = new PrismaCanopyProofMrvGraphRepository(pglitePrismaClient(db));
    const mrvAuthority = new CanopyProofMrvGraphAuthorityService();
    const mrvMethodology = await resolveMrvMethodology(db, methodology.id);
    const monitoringAuthor = await resolveMrvActor(db, methodologyResearcherId, "researcher");
    const reviewAuthor = await resolveMrvActor(db, verifierId, "verifier");
    const decisionAuthor = await resolveMrvActor(db, finalVerifierId, "verifier");
    const mrvReviewer = await resolveMrvActor(db, proofChallengeVerifierId, "verifier");
    const projectEndpoint = await resolveMrvEndpoint(db, "project_registration", project.id);
    const evidenceEndpoint = await resolveMrvEndpoint(db, "evidence_object", registration.id);
    const monitoringEndpoint = await resolveMrvEndpoint(db, "project_monitoring_event", monitoring.id);
    const reviewEndpoint = await resolveMrvEndpoint(db, "human_review", review.id);
    const decisionEndpoint = await resolveMrvEndpoint(db, "verification_decision", finalDecision.id);
    const recordEndpoint = await resolveMrvEndpoint(db, "environmental_proof_record", record.id);
    const mrvEdges = [
      {
        source: monitoringEndpoint,
        relationship: "MEASURES" as const,
        target: projectEndpoint,
        actor: monitoringAuthor,
        createdAt: "2026-07-12T07:06:56.100Z",
      },
      {
        source: reviewEndpoint,
        relationship: "REVIEWS" as const,
        target: evidenceEndpoint,
        actor: reviewAuthor,
        createdAt: "2026-07-12T07:06:56.200Z",
      },
      {
        source: decisionEndpoint,
        relationship: "DECIDES" as const,
        target: evidenceEndpoint,
        actor: decisionAuthor,
        createdAt: "2026-07-12T07:06:56.300Z",
      },
      {
        source: decisionEndpoint,
        relationship: "SUPPORTS" as const,
        target: recordEndpoint,
        actor: decisionAuthor,
        createdAt: "2026-07-12T07:06:56.400Z",
      },
    ].map(({ source, relationship, target, actor, createdAt }) =>
      mrvAuthority.recordEdge(
        {
          source: { type: source.type, id: source.id, root: source.root, eventRoot: source.eventRoot },
          relationship,
          target: { type: target.type, id: target.id, root: target.root, eventRoot: target.eventRoot },
          reasonHash: hashJson({ kind: "lifecycle-pglite-mrv-reason", relationship }),
          limitationHashes: [],
          createdAt,
        },
        { source, target, methodology: mrvMethodology, actor },
      ));
    for (const [index, edge] of mrvEdges.entries()) {
      assert.deepEqual(
        await mrvRepository.commitEdge(edge, `lifecycle-pglite-mrv-edge-${index + 1}`),
        edge,
      );
    }
    const mrvSnapshotBundle = mrvAuthority.recordSnapshot(
      {
        projectId: project.id,
        projectRoot: project.projectRoot,
        methodologyId: methodology.id,
        methodologyPublicationRoot: publication.publicationRoot,
        edgeIds: mrvEdges.map((edge) => edge.id).sort(),
        conflictDisclosureHash: hashJson({ kind: "lifecycle-pglite-mrv-conflict-disclosure" }),
        limitationHashes: [],
        reviewedAt: "2026-07-12T07:06:56.500Z",
      },
      {
        reviewer: mrvReviewer,
        organizationId,
        projectId: project.id,
        projectRoot: project.projectRoot,
        methodology: mrvMethodology,
      },
    );
    assert.equal(mrvSnapshotBundle.snapshot.state, "reviewed_for_lineage");
    assert.deepEqual(
      await mrvRepository.commitSnapshot(
        mrvSnapshotBundle.snapshot,
        mrvSnapshotBundle.members,
        "lifecycle-pglite-mrv-snapshot",
      ),
      mrvSnapshotBundle,
    );

    const lifecycleRepository = new PrismaCanopyProofEnvironmentalProofLifecycleRepository(
      pglitePrismaClient(db),
    );
    assert.deepEqual(lifecycleRepository.getStatus(), {
      service: "canopyproof-environmental-proof-lifecycle-repository",
      storage: "postgresql",
      routeMounted: false,
      productionActivationEnabled: false,
      appendOnly: true,
      tenantScoped: true,
      serializableWrites: true,
      idempotencyRequired: true,
      canonicalRecordReResolved: true,
      governedChallengeProjectionRequired: true,
      reviewedMrvSnapshotRequired: true,
      privateKeyMaterialAccepted: false,
      managedProviderAdapterComposed: false,
    });
    const lifecycleAuthority = new CanopyProofEnvironmentalProofLifecycleAuthorityService();
    const managedVerifier = deterministicManagedSignatureVerifier(agentId);
    const signingKey = await lifecycleAuthority.attestManagedSigningKey(
      {
        organizationId,
        provider: "managed_hsm",
        providerKeyId: "pglite-environmental-proof-lifecycle-key",
        keyVersion: "v1",
        algorithm: "Ed25519",
        publicKeyHash: hashJson({ kind: "lifecycle-pglite-public-key" }),
        providerAttestationHash: hashJson({ kind: "lifecycle-pglite-provider-attestation" }),
        activeFrom: "2026-07-12T06:00:00.000Z",
        expiresAt: "2027-07-12T06:00:00.000Z",
        attestedAt: "2026-07-12T07:06:56.050Z",
      },
      record.issuer,
      managedVerifier,
    );
    const signingKeyAuthorityParity = await db.query<{
      forbidden_key: boolean;
      registrar_valid: boolean;
      verifier_valid: boolean;
      source_root_valid: boolean;
      command_hash_valid: boolean;
      key_hash_valid: boolean;
      key_root_valid: boolean;
      safety_valid: boolean;
    }>(
      `WITH fact AS (SELECT $1::jsonb AS document)
       SELECT
         mrv.has_forbidden_key(document) AS forbidden_key,
         certificates.environmental_proof_lifecycle_actor_is_valid(
           document->'registrar', document->'registrar'->>'id', document->>'organizationId',
           ARRAY['owner','admin']::text[], 'environmental_proof_signing_key:admin'
         ) AS registrar_valid,
         certificates.environmental_proof_lifecycle_external_verifier_is_valid(
           document->>'externalVerifierId', document->>'organizationId'
         ) AS verifier_valid,
         document->>'sourceRoot' = audit.merkle_root(ARRAY(
           SELECT value FROM unnest(ARRAY[
             document->'registrar'->>'authorityRoot', document->>'publicKeyHash',
             document->>'providerAttestationHash', document->>'providerReceiptHash'
           ]::text[]) AS value ORDER BY value
         )) AS source_root_valid,
         document->>'commandHash' = certificates.environmental_proof_signing_key_command_hash(document)
           AS command_hash_valid,
         document->>'keyHash' = certificates.environmental_proof_signing_key_hash(document) AS key_hash_valid,
         document->>'keyRoot' = certificates.environmental_proof_signing_key_root(document) AS key_root_valid,
         document->'safety' = certificates.environmental_proof_lifecycle_safety_canonical() AS safety_valid
       FROM fact`,
      [JSON.stringify(signingKey)],
    );
    assert.deepEqual(signingKeyAuthorityParity.rows[0], {
      forbidden_key: false,
      registrar_valid: true,
      verifier_valid: true,
      source_root_valid: true,
      command_hash_valid: true,
      key_hash_valid: true,
      key_root_valid: true,
      safety_valid: true,
    });
    assert.deepEqual(
      await lifecycleRepository.commitSigningKey(signingKey, "lifecycle-pglite-signing-key"),
      signingKey,
    );
    assert.deepEqual(
      await lifecycleRepository.commitSigningKey(signingKey, "lifecycle-pglite-signing-key"),
      signingKey,
    );
    await assert.rejects(
      lifecycleRepository.commitSigningKey(
        { ...signingKey, providerReceiptHash: hashJson({ kind: "changed-lifecycle-provider-receipt" }) },
        "lifecycle-pglite-signing-key",
      ),
      /CANOPYPROOF_CERTIFICATE_LIFECYCLE_IDEMPOTENCY_CONFLICT/,
    );
    const mrvAuthoritySnapshot = await mrvRepository.loadAuthoritySnapshot(organizationId, project.id);
    const lifecycleBinding = lifecycleAuthority.bindLifecycle(
      {
        recordId: record.id,
        observationStartsAt: "2026-06-01T00:00:00.000Z",
        observationEndsAt: "2026-07-12T07:06:55.000Z",
        validFrom: "2026-07-12T07:06:56.700Z",
        expiresAt: "2026-08-12T07:06:56.700Z",
        monitoringCadenceDays: 7,
        nextMonitoringDueAt: "2026-07-19T07:06:56.700Z",
        monitoringGraceDays: 2,
        assertionType: "restoration_activity",
        assertionScopeHash: hashJson({ kind: "lifecycle-pglite-assertion-scope" }),
        locationScopeHash: hashJson({ kind: "lifecycle-pglite-location-scope" }),
        uncertaintyHash: hashJson({ kind: "lifecycle-pglite-uncertainty" }),
        limitationHashes: [hashJson({ kind: "lifecycle-pglite-limitation" })],
        relianceStatement: "environmental_accountability_only",
        boundAt: "2026-07-12T07:06:56.600Z",
      },
      {
        record,
        governedRecordProjection: issuedRecordProjection,
        mrvAuthoritySnapshot,
        issuer: record.issuer,
        signingKeyAuthorityId: signingKey.id,
      },
    );
    assert.deepEqual(
      await lifecycleRepository.commitBinding(lifecycleBinding, "lifecycle-pglite-binding"),
      lifecycleBinding,
    );
    const signatureReceipt = await lifecycleAuthority.recordSignatureReceipt(
      lifecycleBinding.id,
      {
        detachedSignature: "cGdsaXRlX2V4dGVybmFsX21hbmFnZWRfc2lnbmF0dXJlX3Yx",
        signedAt: "2026-07-12T07:06:56.650Z",
      },
      managedVerifier,
    );
    assert.deepEqual(
      await lifecycleRepository.commitSignatureReceipt(
        signatureReceipt,
        "lifecycle-pglite-signature-receipt",
      ),
      signatureReceipt,
    );
    const activeLifecycle = await lifecycleRepository.projectLifecycle(
      organizationId,
      lifecycleBinding.id,
      "2026-07-12T07:06:56.800Z",
    );
    assert.equal(activeLifecycle.state, "active");
    assert.equal(activeLifecycle.signatureVerified, true);
    assert.equal(activeLifecycle.boundMrvSnapshotCurrent, true);
    assert.equal(activeLifecycle.sourceAuthorityCurrent, true);
    const restartedLifecycle = CanopyProofEnvironmentalProofLifecycleAuthorityService.fromAuthoritySnapshot(
      await lifecycleRepository.loadAuthoritySnapshot(organizationId),
    );
    assert.deepEqual(restartedLifecycle.getSigningKey(signingKey.id), signingKey);
    assert.deepEqual(restartedLifecycle.getBinding(lifecycleBinding.id), lifecycleBinding);
    assert.deepEqual(restartedLifecycle.getSignatureReceipt(signatureReceipt.id), signatureReceipt);

    const lifecycleParity = await db.query<{
      key_root: string;
      binding_root: string;
      receipt_root: string;
      projection_root: string;
    }>(
      `SELECT
         certificates.environmental_proof_signing_key_root(key_fact.fact_record) AS key_root,
         certificates.environmental_proof_lifecycle_binding_root(binding_fact.fact_record) AS binding_root,
         certificates.environmental_proof_signature_receipt_root(receipt.fact_record) AS receipt_root,
         projection.projection_root
       FROM governance.environmental_proof_signing_key_attestation_facts key_fact
       JOIN certificates.environmental_proof_lifecycle_binding_facts binding_fact
         ON binding_fact.signing_key_authority_id = key_fact.id
       JOIN certificates.environmental_proof_signature_receipt_facts receipt
         ON receipt.binding_id = binding_fact.id
       CROSS JOIN LATERAL certificates.environmental_proof_lifecycle_projection(
         binding_fact.id, $2::timestamptz
       ) projection
       WHERE binding_fact.id = $1`,
      [lifecycleBinding.id, "2026-07-12T07:06:56.800Z"],
    );
    assert.deepEqual(lifecycleParity.rows[0], {
      key_root: signingKey.keyRoot,
      binding_root: lifecycleBinding.bindingRoot,
      receipt_root: signatureReceipt.receiptRoot,
      projection_root: activeLifecycle.projectionRoot,
    });
    const lifecycleDatabaseControls = await db.query<{ policy_count: number; forced_count: number }>(`
      SELECT
        (SELECT count(*)::integer FROM pg_policies
          WHERE (schemaname, tablename) IN (
            ('governance', 'environmental_proof_signing_key_attestation_facts'),
            ('governance', 'environmental_proof_signing_key_revocation_facts'),
            ('certificates', 'environmental_proof_lifecycle_binding_facts'),
            ('certificates', 'environmental_proof_signature_receipt_facts'),
            ('governance', 'environmental_proof_lifecycle_control_facts')
          )) AS policy_count,
        (SELECT count(*)::integer FROM pg_class relation
          JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
          WHERE relation.relforcerowsecurity
            AND (namespace.nspname, relation.relname) IN (
              ('governance', 'environmental_proof_signing_key_attestation_facts'),
              ('governance', 'environmental_proof_signing_key_revocation_facts'),
              ('certificates', 'environmental_proof_lifecycle_binding_facts'),
              ('certificates', 'environmental_proof_signature_receipt_facts'),
              ('governance', 'environmental_proof_lifecycle_control_facts')
            )) AS forced_count
    `);
    assert.deepEqual(lifecycleDatabaseControls.rows[0], { policy_count: 5, forced_count: 5 });
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [proofIssuerId]);
        await transaction.query(
          "UPDATE certificates.environmental_proof_lifecycle_binding_facts SET monitoring_grace_days = 3 WHERE id = $1",
          [lifecycleBinding.id],
        );
      }),
      /CANOPYPROOF_CERTIFICATE_LIFECYCLE_APPEND_ONLY_VIOLATION/,
    );
    await assert.rejects(
      db.exec(
        await readFile(
          join(process.cwd(), "services/api/prisma/environmental-proof-lifecycle.rollback.sql"),
          "utf8",
        ),
      ),
      /CANOPYPROOF_CERTIFICATE_LIFECYCLE_ROLLBACK_REQUIRES_EMPTY_AUTHORITY/,
    );

    const transparencyRepository = new PrismaCanopyProofPublicTransparencyRepository(
      pglitePrismaClient(db),
    );
    assert.deepEqual(transparencyRepository.getStatus(), {
      service: "canopyproof-public-transparency-repository",
      storage: "postgresql",
      routeMounted: false,
      productionActivationEnabled: false,
      publicRelianceAuthorized: false,
      appendOnly: true,
      tenantScoped: true,
      serializableWrites: true,
      exactRetryRequired: true,
      currentSourceReResolved: true,
      independentHumanPrivacyReviewRequired: true,
      accreditedHumanPublisherRequired: true,
    });
    const transparencyReviewer = await resolveVerificationActor(
      db,
      proofChallengeVerifierId,
      "verifier",
    );
    const transparencyPublisher = await resolveVerificationActor(
      db,
      proofChallengeAdminId,
      "admin",
    );
    assert.equal(record.contributorIds.includes(transparencyReviewer.id), false);
    assert.equal(record.contributorIds.includes(transparencyPublisher.id), false);
    const transparencyAuthority = new CanopyProofPublicTransparencyAuthorityService();
    const reviewSource = {
      record,
      governedRecordProjection: issuedRecordProjection,
      lifecycleBinding,
      lifecycleProjection: activeLifecycle,
      signatureReceipt,
    };
    const disclosureReview = transparencyAuthority.reviewDisclosure(
      {
        organizationId,
        projectId: project.id,
        recordId: record.id,
        expectedRecordRoot: record.recordRoot,
        expectedLifecycleProjectionRoot: activeLifecycle.projectionRoot,
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
        limitationHashes: [hashJson({ kind: "public-transparency-pglite-limitation" })],
        reviewedAt: "2026-07-12T07:06:56.800Z",
      },
      { reviewer: transparencyReviewer, source: reviewSource },
    );
    let resolvedTransparencySources = 0;
    const resolveReviewSource = async () => {
      resolvedTransparencySources += 1;
      return reviewSource;
    };
    assert.deepEqual(
      await transparencyRepository.commitReview(
        disclosureReview,
        "public-transparency-pglite-review",
        resolveReviewSource,
      ),
      disclosureReview,
    );
    assert.equal(resolvedTransparencySources, 1);
    assert.deepEqual(
      await transparencyRepository.commitReview(
        disclosureReview,
        "public-transparency-pglite-review",
        resolveReviewSource,
      ),
      disclosureReview,
    );
    assert.equal(resolvedTransparencySources, 1, "exact retry must resolve from its durable command receipt");
    await assert.rejects(
      transparencyRepository.commitReview(
        { ...disclosureReview, classification: "sensitive" },
        "public-transparency-pglite-review",
        resolveReviewSource,
      ),
      /CANOPYPROOF_PUBLIC_TRANSPARENCY_IDEMPOTENCY_CONFLICT/,
    );

    const publicationLifecycle = await lifecycleRepository.projectLifecycle(
      organizationId,
      lifecycleBinding.id,
      "2026-07-12T07:06:56.900Z",
    );
    const publicationSource = {
      ...reviewSource,
      lifecycleProjection: publicationLifecycle,
    };
    const transparencyPublication = transparencyAuthority.publish(
      {
        reviewId: disclosureReview.id,
        expectedReviewRoot: disclosureReview.reviewRoot,
        expectedLifecycleProjectionRoot: publicationLifecycle.projectionRoot,
        publishedAt: "2026-07-12T07:06:56.900Z",
      },
      { publisher: transparencyPublisher, source: publicationSource },
    );
    assert.deepEqual(
      await transparencyRepository.commitPublication(
        transparencyPublication,
        "public-transparency-pglite-publication",
        async () => publicationSource,
      ),
      transparencyPublication,
    );
    assert.deepEqual(
      await transparencyRepository.commitPublication(
        transparencyPublication,
        "public-transparency-pglite-publication",
        async () => publicationSource,
      ),
      transparencyPublication,
    );
    const transparencyProjection = await transparencyRepository.projectPublication(
      organizationId,
      transparencyPublication.id,
      "2026-07-12T07:06:56.900Z",
      async () => publicationSource,
    );
    assert.equal(transparencyProjection.state, "active");
    assert.equal(transparencyProjection.location.disclosure, "region");
    assert.equal("latitude" in transparencyProjection.location, false);
    assert.equal("longitude" in transparencyProjection.location, false);
    assert.deepEqual(
      await transparencyRepository.getReview(organizationId, disclosureReview.id),
      disclosureReview,
    );
    assert.deepEqual(
      await transparencyRepository.getPublication(organizationId, transparencyPublication.id),
      transparencyPublication,
    );
    const restartedTransparency = CanopyProofPublicTransparencyAuthorityService.fromAuthoritySnapshot(
      await transparencyRepository.loadAuthoritySnapshot(organizationId),
    );
    assert.deepEqual(restartedTransparency.getReview(disclosureReview.id), disclosureReview);
    assert.deepEqual(
      restartedTransparency.getPublication(transparencyPublication.id),
      transparencyPublication,
    );

    const explorerRepository = new PrismaCanopyProofPublicExplorerRepository(
      pglitePrismaClient(db),
      createCanopyProofPublicExplorerSourceResolver({
        trustRegistry: service,
        lifecycleRepository,
      }),
    );
    assert.deepEqual(explorerRepository.getStatus(), {
      service: "canopyproof-public-explorer-repository",
      storage: "postgresql",
      routeMounted: false,
      productionActivationEnabled: false,
      anonymousMutationAllowed: false,
      locatorAppendOnly: true,
      tenantContextRequired: true,
      bypassRlsRequired: false,
      currentSourceReResolved: true,
    });
    const locator = await db.query<{
      publication_id: string;
      public_project_id: string;
      public_organization_id: string;
      organization_id: string;
      publication_root: string;
      audit_event_root: string;
    }>(
      `SELECT publication_id, public_project_id, public_organization_id, organization_id,
         publication_root, audit_event_root
       FROM transparency.public_transparency_query_catalog
       WHERE publication_id = $1`,
      [transparencyPublication.id],
    );
    assert.deepEqual(locator.rows[0], {
      publication_id: transparencyPublication.id,
      public_project_id: transparencyPublication.publicProjectId,
      public_organization_id: transparencyPublication.publicOrganizationId,
      organization_id: organizationId,
      publication_root: transparencyPublication.publicationRoot,
      audit_event_root: transparencyPublication.auditEvent.eventRoot,
    });
    const explorerProjection = await explorerRepository.getProject(
      transparencyPublication.publicProjectId,
      "2026-07-12T07:06:56.900Z",
    );
    assert.equal(explorerProjection.state, "active");
    assert.equal(explorerProjection.projectionRoot, transparencyProjection.projectionRoot);
    const explorerResponse = serializeCanopyProofPublicExplorerProject(explorerProjection);
    const serializedExplorer = JSON.stringify(explorerResponse);
    assert.equal(serializedExplorer.includes(organizationId), false);
    assert.equal(serializedExplorer.includes(record.id), false);
    assert.equal(serializedExplorer.includes(transparencyReviewer.id), false);
    assert.equal(serializedExplorer.includes(transparencyPublisher.id), false);
    assert.equal(
      (await explorerRepository.verifyPublication(
        transparencyPublication.id,
        "2026-07-12T07:06:56.900Z",
      )).projectionRoot,
      explorerProjection.projectionRoot,
    );
    const explorerHistory = await explorerRepository.getProjectHistory(
      transparencyPublication.publicProjectId,
      { evaluatedAt: "2026-07-12T07:06:56.900Z", limit: 20 },
    );
    assert.equal(explorerHistory.projections.length, 1);
    assert.equal(explorerHistory.nextCursor, null);
    await assert.rejects(
      explorerRepository.getProject("cp_public_project_000000000000000000000000", "2026-07-12T07:06:56.900Z"),
      /CANOPYPROOF_PUBLIC_EXPLORER_NOT_FOUND/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [transparencyPublisher.id]);
        await transaction.query(
          `INSERT INTO transparency.public_transparency_query_catalog (
             publication_id, id, public_project_id, public_organization_id, organization_id,
             publication_root, published_at, audit_event_root
           ) VALUES ($1, $1, $2, $3, $4, $5, $6, $7)`,
          [
            "cp_public_transparency_000000000000000000000000",
            transparencyPublication.publicProjectId,
            transparencyPublication.publicOrganizationId,
            organizationId,
            transparencyPublication.publicationRoot,
            "2026-07-12T07:06:56.900Z",
            transparencyPublication.auditEvent.eventRoot,
          ],
        );
      }),
      /CANOPYPROOF_PUBLIC_EXPLORER_CATALOG_SOURCE_MISMATCH/,
    );

    const transparencyParity = await db.query<{
      review_command_hash: string;
      review_hash: string;
      review_root: string;
      publication_command_hash: string;
      publication_hash: string;
      publication_root: string;
    }>(
      `SELECT
         transparency.public_disclosure_review_command_hash(review.fact_record) AS review_command_hash,
         transparency.public_disclosure_review_hash(review.fact_record) AS review_hash,
         transparency.public_disclosure_review_root(review.fact_record) AS review_root,
         transparency.public_transparency_publication_command_hash(publication.fact_record)
           AS publication_command_hash,
         transparency.public_transparency_publication_hash(publication.fact_record) AS publication_hash,
         transparency.public_transparency_publication_root(publication.fact_record) AS publication_root
       FROM transparency.public_disclosure_review_facts review
       JOIN transparency.public_transparency_publication_facts publication
         ON publication.review_id = review.id
       WHERE review.id = $1`,
      [disclosureReview.id],
    );
    assert.deepEqual(transparencyParity.rows[0], {
      review_command_hash: disclosureReview.commandHash,
      review_hash: disclosureReview.reviewHash,
      review_root: disclosureReview.reviewRoot,
      publication_command_hash: transparencyPublication.commandHash,
      publication_hash: transparencyPublication.publicationHash,
      publication_root: transparencyPublication.publicationRoot,
    });
    const transparencyDatabaseControls = await db.query<{
      policy_count: number;
      forced_count: number;
      audit_count: number;
    }>(`
      SELECT
        (SELECT count(*)::integer FROM pg_policies
          WHERE (schemaname, tablename) IN (
            ('transparency', 'public_disclosure_review_facts'),
            ('transparency', 'public_transparency_publication_facts')
          )) AS policy_count,
        (SELECT count(*)::integer FROM pg_class relation
          JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
          WHERE relation.relforcerowsecurity
            AND (namespace.nspname, relation.relname) IN (
              ('transparency', 'public_disclosure_review_facts'),
              ('transparency', 'public_transparency_publication_facts')
            )) AS forced_count,
        (SELECT count(*)::integer FROM audit.event_log
          WHERE schema_name = 'transparency'
            AND table_name IN (
              'public_disclosure_review_facts',
              'public_transparency_publication_facts'
            )) AS audit_count
    `);
    assert.deepEqual(transparencyDatabaseControls.rows[0], {
      policy_count: 2,
      forced_count: 2,
      audit_count: 2,
    });
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [transparencyPublisher.id]);
        await transaction.query(
          "UPDATE transparency.public_transparency_publication_facts SET public_project_id = 'tampered' WHERE id = $1",
          [transparencyPublication.id],
        );
      }),
      /CANOPYPROOF_PUBLIC_TRANSPARENCY_APPEND_ONLY_VIOLATION/,
    );
    await assert.rejects(
      db.exec(
        `UPDATE transparency.public_transparency_query_catalog
         SET public_project_id = 'cp_public_project_000000000000000000000000'
         WHERE publication_id = '${transparencyPublication.id}'`,
      ),
      /CANOPYPROOF_PUBLIC_TRANSPARENCY_APPEND_ONLY_VIOLATION/,
    );
    await assert.rejects(
      db.exec(
        `DELETE FROM transparency.public_transparency_query_catalog
         WHERE publication_id = '${transparencyPublication.id}'`,
      ),
      /CANOPYPROOF_PUBLIC_TRANSPARENCY_APPEND_ONLY_VIOLATION/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [transparencyPublisher.id]);
        await transaction.query(
          "DELETE FROM transparency.public_transparency_publication_facts WHERE id = $1",
          [transparencyPublication.id],
        );
      }),
      /CANOPYPROOF_PUBLIC_TRANSPARENCY_APPEND_ONLY_VIOLATION/,
    );
    await db.exec("CREATE ROLE canopyproof_transparency_rls_reader NOLOGIN NOBYPASSRLS");
    await db.exec("GRANT USAGE ON SCHEMA transparency TO canopyproof_transparency_rls_reader");
    await db.exec(
      "GRANT SELECT ON transparency.public_disclosure_review_facts, transparency.public_transparency_publication_facts TO canopyproof_transparency_rls_reader",
    );
    const crossTenantVisibility = await db.transaction(async (transaction) => {
      await transaction.query("SET LOCAL ROLE canopyproof_transparency_rls_reader");
      await transaction.query("SELECT set_config('app.organization_id', $1, true)", [challengerOrganizationId]);
      return transaction.query<{ count: number }>(
        "SELECT count(*)::integer AS count FROM transparency.public_transparency_publication_facts",
      );
    });
    assert.equal(crossTenantVisibility.rows[0]?.count, 0);
    const laterLifecycle = await lifecycleRepository.projectLifecycle(
      organizationId,
      lifecycleBinding.id,
      "2026-07-12T07:06:56.950Z",
    );
    const laterReview = transparencyAuthority.reviewDisclosure(
      {
        organizationId,
        projectId: project.id,
        recordId: record.id,
        expectedRecordRoot: record.recordRoot,
        expectedLifecycleProjectionRoot: laterLifecycle.projectionRoot,
        classification: "restricted",
        locationDisclosure: "withheld",
        areaDisclosure: "withheld",
        reasonCodes: [
          "community_safety_reviewed",
          "data_rights_reviewed",
          "location_minimized",
          "personal_data_excluded",
        ],
        limitationHashes: [],
        reviewedAt: "2026-07-12T07:06:56.950Z",
      },
      {
        reviewer: transparencyReviewer,
        source: { ...reviewSource, lifecycleProjection: laterLifecycle },
      },
    );
    await assert.rejects(
      transparencyRepository.commitReview(
        laterReview,
        "public-transparency-pglite-stale-source",
        async () => reviewSource,
      ),
      /source authority scope or lineage is invalid|CURRENT_SOURCE_MISMATCH/,
    );
    const rejectedTransparencyWrite = await db.query<{
      fact_count: number;
      event_count: number;
      receipt_count: number;
    }>(
      `SELECT
         (SELECT count(*)::integer FROM transparency.public_disclosure_review_facts
           WHERE id = $1) AS fact_count,
         (SELECT count(*)::integer FROM audit.domain_events
           WHERE entity_id = $1) AS event_count,
         (SELECT count(*)::integer FROM audit.command_receipts
           WHERE result_entity_id = $1) AS receipt_count`,
      [laterReview.id],
    );
    assert.deepEqual(rejectedTransparencyWrite.rows[0], {
      fact_count: 0,
      event_count: 0,
      receipt_count: 0,
    });
    await assert.rejects(
      db.exec(
        await readFile(
          join(process.cwd(), "services/api/prisma/public-transparency-authority.rollback.sql"),
          "utf8",
        ),
      ),
      /CANOPYPROOF_PUBLIC_TRANSPARENCY_ROLLBACK_REQUIRES_EMPTY_AUTHORITY/,
    );
    await assert.rejects(
      db.exec(
        await readFile(
          join(process.cwd(), "services/api/prisma/public-transparency-explorer.rollback.sql"),
          "utf8",
        ),
      ),
      /CANOPYPROOF_PUBLIC_EXPLORER_ROLLBACK_REQUIRES_EMPTY_CATALOG/,
    );

    const reportingOrganizationResult = await db.query<{
      id: string;
      name: string;
      verification_status: "verified";
      organization_root: string;
    }>(
      `SELECT id, COALESCE(name, legal_name) AS name,
         verification_status, profile_hash AS organization_root
       FROM organizations.organizations WHERE id = $1`,
      [organizationId],
    );
    const reportingOrganization = reportingOrganizationResult.rows[0];
    assert.ok(reportingOrganization);
    const reportingAuthority = new CanopyProofCanonicalEsgReportingAuthorityService();
    const reportingSource = {
      record,
      governedRecordProjection: issuedRecordProjection,
      lifecycleBinding,
      lifecycleProjection: activeLifecycle,
      signatureReceipt,
    };
    const reportingRepository = new PrismaCanopyProofCanonicalEsgReportingRepository(
      pglitePrismaClient(db),
    );
    assert.deepEqual(reportingRepository.getStatus(), {
      service: "canopyproof-canonical-esg-reporting-repository",
      storage: "postgresql",
      routeMounted: false,
      productionActivationEnabled: false,
      appendOnly: true,
      tenantScoped: true,
      serializableWrites: true,
      exactRetryRequired: true,
      currentEnvironmentalProofReResolved: true,
      activeSignedLifecycleRequired: true,
      accreditedHumanPublisherRequired: true,
      currentGovernedMetricRequired: true,
      frameworkPreparationOnly: true,
    });

    const metricMethodology = await service.getCurrentMethodologyPublicationBundle(
      methodology.id,
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
    const metricPublisher = record.issuer;
    const metricDefinitionReviewers = [
      await resolveVerificationActor(db, methodologyVerifierId, "verifier"),
      await resolveVerificationActor(db, methodologyResearcherId, "researcher"),
    ];
    const metricCalculator = await resolveVerificationActor(db, proofIssuerId, "admin");
    const metricReviewer = await resolveVerificationActor(db, finalVerifierId, "verifier");
    const metricAuthority = new CanopyProofEsgMetricAuthorityService();
    const metricDefinition = metricAuthority.publishDefinition(
      {
        organizationId,
        slug: "verified_tree_survival_rate",
        version: "v1.0.0",
        title: "Verified tree survival rate",
        description: "Project-level survival percentage derived only from current signed Environmental Proof and reviewed MRV authority.",
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
            rationale: "Prepares a bounded survival metric for independent nature-related disclosure mapping review.",
            limitations: ["This mapping is preparation only and is not an assurance opinion."],
          },
        ],
        methodologyPublicationId: metricMethodology.publication.id,
        limitations: ["The value is bounded to current signed source authority and may be challenged or superseded."],
        effectiveAt: "2026-07-12T07:06:56.500Z",
      },
      {
        organization: {
          id: reportingOrganization.id,
          name: reportingOrganization.name,
          verificationStatus: reportingOrganization.verification_status,
          organizationRoot: reportingOrganization.organization_root,
        },
        publisher: metricPublisher,
        reviewers: metricDefinitionReviewers,
        methodology: metricMethodology,
        methodologyProjection: metricMethodologyProjection,
      },
    );
    const metricDefinitionProjection = metricAuthority.projectDefinition(
      metricDefinition.id,
      metricMethodologyProjection,
      "2026-07-12T07:06:56.800Z",
    );
    const metricResult = metricAuthority.recordResult(
      {
        organizationId,
        projectId: project.id,
        definitionId: metricDefinition.id,
        sourceRecordIds: [record.id],
        reportingPeriod: {
          startsAt: "2026-06-01T00:00:00.000Z",
          endsAt: "2026-07-12T07:06:56.800Z",
        },
        observationPeriod: {
          startsAt: "2026-07-01T00:00:00.000Z",
          endsAt: "2026-07-12T07:06:56.700Z",
        },
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
        calculationArtifactHash: hashJson({ kind: "pglite-esg-metric-calculation", recordRoot: record.recordRoot }),
        reviewRationale: "Independent accredited review accepts the exact decimal result and bounded uncertainty source graph.",
        limitations: ["No assurance, credit, offset, financial instrument, or guaranteed outcome is created."],
        calculatedAt: "2026-07-12T07:06:56.700Z",
        reviewedAt: "2026-07-12T07:06:56.800Z",
      },
      {
        definition: metricDefinition,
        definitionProjection: metricDefinitionProjection,
        calculator: metricCalculator,
        reviewer: metricReviewer,
        sources: [reportingSource],
      },
    );
    const metricRepository = new PrismaCanopyProofEsgMetricRepository(pglitePrismaClient(db));
    assert.deepEqual(metricRepository.getStatus(), {
      service: "canopyproof-esg-metric-repository",
      storage: "postgresql",
      routeMounted: false,
      productionActivationEnabled: false,
      appendOnly: true,
      tenantScoped: true,
      serializableWrites: true,
      exactRetryRequired: true,
      currentMethodologyReResolved: true,
      currentEnvironmentalProofReResolved: true,
      independentHumanReviewRequired: true,
      frameworkPreparationOnly: true,
    });
    assert.deepEqual(
      await metricRepository.commitDefinition(metricDefinition, "esg-metric-definition-pglite"),
      metricDefinition,
    );
    assert.deepEqual(
      await metricRepository.commitDefinition(metricDefinition, "esg-metric-definition-pglite"),
      metricDefinition,
    );
    await assert.rejects(
      metricRepository.commitDefinition(
        { ...metricDefinition, title: "Substituted metric title" },
        "esg-metric-definition-pglite",
      ),
      /CANOPYPROOF_ESG_METRIC_IDEMPOTENCY_CONFLICT/,
    );
    assert.deepEqual(
      await metricRepository.projectDefinition(
        organizationId,
        metricDefinition.id,
        "2026-07-12T07:06:56.800Z",
      ),
      metricDefinitionProjection,
    );
    assert.deepEqual(
      await metricRepository.commitResult(metricResult, "esg-metric-result-pglite"),
      metricResult,
    );
    assert.deepEqual(
      await metricRepository.commitResult(metricResult, "esg-metric-result-pglite"),
      metricResult,
    );
    const metricResultProjection = metricAuthority.projectResult(
      metricResult.result.id,
      metricDefinitionProjection,
      [reportingSource],
      "2026-07-12T07:06:56.800Z",
    );
    assert.deepEqual(
      await metricRepository.projectResult(
        organizationId,
        metricResult.result.id,
        "2026-07-12T07:06:56.800Z",
      ),
      metricResultProjection,
    );
    assert.equal(metricResultProjection.state, "current");
    const metricParity = await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
      return transaction.query<{
        definition_hash: string;
        definition_root: string;
        source_hash: string;
        source_root: string;
        result_hash: string;
        result_root: string;
      }>(
        `SELECT
           reporting.esg_metric_definition_hash(definition.fact_record) AS definition_hash,
           reporting.esg_metric_definition_root(definition.fact_record) AS definition_root,
           reporting.esg_metric_source_member_hash(source.fact_record) AS source_hash,
           reporting.esg_metric_source_member_root(source.fact_record) AS source_root,
           reporting.esg_metric_result_hash(result.fact_record) AS result_hash,
           reporting.esg_metric_result_root(result.fact_record) AS result_root
         FROM reporting.esg_metric_definition_facts definition
         JOIN reporting.esg_metric_result_facts result ON result.definition_id = definition.id
         JOIN reporting.esg_metric_result_source_facts source ON source.result_id = result.id
         WHERE result.id = $1`,
        [metricResult.result.id],
      );
    });
    assert.deepEqual(metricParity.rows[0], {
      definition_hash: metricDefinition.definitionHash,
      definition_root: metricDefinition.definitionRoot,
      source_hash: metricResult.sources[0]!.memberHash,
      source_root: metricResult.sources[0]!.memberRoot,
      result_hash: metricResult.result.resultHash,
      result_root: metricResult.result.resultRoot,
    });
    await assert.rejects(
      metricRepository.getDefinition(challengerOrganizationId, metricDefinition.id),
      /definition not found/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [proofIssuerId]);
        await transaction.query(
          "UPDATE reporting.esg_metric_result_facts SET decimal_value = '1' WHERE id = $1",
          [metricResult.result.id],
        );
      }),
      /CANOPYPROOF_ESG_METRIC_APPEND_ONLY_VIOLATION/,
    );
    await assert.rejects(
      db.exec(
        await readFile(
          join(process.cwd(), "services/api/prisma/esg-metric-authority.rollback.sql"),
          "utf8",
        ),
      ),
      /CANOPYPROOF_ESG_METRIC_ROLLBACK_REQUIRES_EMPTY_AUTHORITY/,
    );

    const reportingBundle = reportingAuthority.publishReport(
      {
        organizationId,
        projectId: project.id,
        sourceRecordIds: [record.id],
        metricResultIds: [metricResult.result.id],
        reportingPeriod: {
          startsAt: "2026-06-01T00:00:00.000Z",
          endsAt: "2026-07-12T07:06:56.700Z",
        },
        frameworks: ["TNFD", "SDG", "GRI"],
        materialTopics: ["Biodiversity condition", "Restoration monitoring"],
        generatedAt: "2026-07-12T07:06:56.800Z",
      },
      {
        organization: {
          id: reportingOrganization.id,
          name: reportingOrganization.name,
          verificationStatus: reportingOrganization.verification_status,
          organizationRoot: reportingOrganization.organization_root,
        },
        publisher: record.issuer,
        sources: [reportingSource],
        metrics: [{ result: metricResult.result, projection: metricResultProjection }],
      },
    );
    assert.deepEqual(
      await reportingRepository.commitReport(reportingBundle, "canonical-esg-pglite-report"),
      reportingBundle,
    );
    assert.deepEqual(
      await reportingRepository.commitReport(reportingBundle, "canonical-esg-pglite-report"),
      reportingBundle,
    );
    await assert.rejects(
      reportingRepository.commitReport(
        {
          ...reportingBundle,
          report: { ...reportingBundle.report, materialTopics: ["Substituted reporting topic"] },
        },
        "canonical-esg-pglite-report",
      ),
      /CANOPYPROOF_CANONICAL_ESG_IDEMPOTENCY_CONFLICT/,
    );
    const currentReportingProjection = await reportingRepository.projectReport(
      organizationId,
      reportingBundle.report.id,
      "2026-07-12T07:06:56.800Z",
    );
    assert.deepEqual(
      currentReportingProjection,
      reportingAuthority.projectReport(
        reportingBundle.report.id,
        [reportingSource],
        [metricResultProjection],
        "2026-07-12T07:06:56.800Z",
      ),
    );
    assert.equal(currentReportingProjection.state, "current");
    assert.equal(currentReportingProjection.currentMetricCount, 1);
    const reportingParity = await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
      return transaction.query<{
        member_hash: string;
        member_root: string;
        metric_member_hash: string;
        metric_member_root: string;
        artifact_hash: string;
        report_hash: string;
        report_root: string;
      }>(
        `SELECT
           reporting.canonical_esg_member_hash(member.fact_record) AS member_hash,
           reporting.canonical_esg_member_root(member.fact_record) AS member_root,
           reporting.canonical_esg_metric_member_hash(metric_member.fact_record) AS metric_member_hash,
           reporting.canonical_esg_metric_member_root(metric_member.fact_record) AS metric_member_root,
           reporting.canonical_esg_artifact_hash(report.fact_record) AS artifact_hash,
           reporting.canonical_esg_report_hash(report.fact_record) AS report_hash,
           reporting.canonical_esg_report_root(report.fact_record) AS report_root
         FROM reporting.canonical_esg_report_facts report
         JOIN reporting.canonical_esg_report_member_facts member ON member.report_id = report.id
         JOIN reporting.canonical_esg_report_metric_member_facts metric_member
           ON metric_member.report_id = report.id
         WHERE report.id = $1`,
        [reportingBundle.report.id],
      );
    });
    assert.deepEqual(reportingParity.rows[0], {
      member_hash: reportingBundle.members[0]!.memberHash,
      member_root: reportingBundle.members[0]!.memberRoot,
      metric_member_hash: reportingBundle.metricMembers[0]!.memberHash,
      metric_member_root: reportingBundle.metricMembers[0]!.memberRoot,
      artifact_hash: reportingBundle.report.artifactHash,
      report_hash: reportingBundle.report.reportHash,
      report_root: reportingBundle.report.reportRoot,
    });
    await assert.rejects(
      reportingRepository.getReport(challengerOrganizationId, reportingBundle.report.id),
      /report not found/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [proofIssuerId]);
        await transaction.query(
          "UPDATE reporting.canonical_esg_report_metric_member_facts SET decimal_value = '1' WHERE report_id = $1",
          [reportingBundle.report.id],
        );
      }),
      /CANOPYPROOF_CANONICAL_ESG_APPEND_ONLY_VIOLATION/,
    );
    await assert.rejects(
      db.exec(
        await readFile(
          join(process.cwd(), "services/api/prisma/esg-reporting-authority.rollback.sql"),
          "utf8",
        ),
      ),
      /CANOPYPROOF_CANONICAL_ESG_ROLLBACK_REQUIRES_EMPTY_AUTHORITY/,
    );

    const proofChallengeInput = {
      reason: "monitoring_contradiction",
      severity: "high",
      rationale: "Independent external observation contradicts the monitoring basis and requires governed record review.",
      supportingArtifactHashes: ["48".repeat(32)],
      sourceEventRoots: [record.auditEvent.eventRoot],
      openedAt: "2026-07-12T07:06:57.000Z",
    } as const;
    const proofChallengeBundle = await service.openEnvironmentalProofChallenge(
      record.id,
      proofChallengeInput,
      challengerOrganizationId,
      challengerId,
      "researcher",
      "environmental-proof-record-challenge",
    );
    assert.equal(proofChallengeBundle.challenge.recordRoot, record.recordRoot);
    assert.equal(proofChallengeBundle.challenge.challengerOrganizationId, challengerOrganizationId);
    assert.equal(proofChallengeBundle.riskSignal.riskLevel, "high");
    assert.equal(
      (
        await service.openEnvironmentalProofChallenge(
          record.id,
          proofChallengeInput,
          challengerOrganizationId,
          challengerId,
          "researcher",
          "environmental-proof-record-challenge",
        )
      ).challenge.challengeRoot,
      proofChallengeBundle.challenge.challengeRoot,
    );
    assert.equal(
      (await service.getEnvironmentalProofRecordStatus(record.id, organizationId)).state,
      "challenged",
    );
    const challengedLifecycle = await lifecycleRepository.projectLifecycle(
      organizationId,
      lifecycleBinding.id,
      "2026-07-12T07:06:57.100Z",
    );
    assert.equal(challengedLifecycle.state, "challenged");
    assert.equal(challengedLifecycle.sourceAuthorityCurrent, true);
    assert.ok(challengedLifecycle.issueCodes.includes("record_challenged"));
    const challengedExplorerProjection = await explorerRepository.getProject(
      transparencyPublication.publicProjectId,
      "2026-07-12T07:06:57.100Z",
    );
    assert.equal(challengedExplorerProjection.state, "challenged");
    assert.equal(
      challengedExplorerProjection.challenge.root,
      proofChallengeBundle.challenge.challengeRoot,
    );
    assert.ok(challengedExplorerProjection.issueCodes.includes("record_challenged"));
    assert.notEqual(challengedExplorerProjection.projectionRoot, explorerProjection.projectionRoot);
    const challengedReportingProjection = await reportingRepository.projectReport(
      organizationId,
      reportingBundle.report.id,
      "2026-07-12T07:06:57.100Z",
    );
    assert.equal(challengedReportingProjection.state, "challenged");
    assert.ok(challengedReportingProjection.issueCodes.includes(`source_not_current:${record.id}`));
    await assert.rejects(
      service.getEnvironmentalProofChallenge(proofChallengeBundle.challenge.id, challengerOrganizationId),
      /organization scope mismatch/,
    );

    const proofChallengeParity = await db.query<{
      command_hash: string;
      source_root: string;
      challenge_hash: string;
      challenge_root: string;
      payload_hash: string;
      risk_source_root: string;
      risk_hash: string;
      risk_root: string;
      risk_payload_hash: string;
    }>(
      `SELECT
         certificates.environmental_proof_challenge_command_hash(challenge) AS command_hash,
         certificates.environmental_proof_challenge_source_root(challenge) AS source_root,
         certificates.environmental_proof_challenge_hash(challenge) AS challenge_hash,
         certificates.environmental_proof_challenge_root(challenge) AS challenge_root,
         certificates.environmental_proof_challenge_payload_hash(challenge) AS payload_hash,
         certificates.environmental_proof_challenge_risk_source_root(risk) AS risk_source_root,
         certificates.environmental_proof_challenge_risk_hash(risk) AS risk_hash,
         certificates.environmental_proof_challenge_risk_root(risk) AS risk_root,
         certificates.environmental_proof_challenge_risk_payload_hash(risk) AS risk_payload_hash
       FROM certificates.environmental_proof_challenges challenge
       JOIN certificates.environmental_proof_challenge_risk_signals risk
         ON risk.challenge_id = challenge.id
       WHERE challenge.id = $1`,
      [proofChallengeBundle.challenge.id],
    );
    assert.equal(proofChallengeParity.rows[0]?.command_hash, proofChallengeBundle.challenge.commandHash);
    assert.equal(proofChallengeParity.rows[0]?.source_root, proofChallengeBundle.challenge.sourceRoot);
    assert.equal(proofChallengeParity.rows[0]?.challenge_hash, proofChallengeBundle.challenge.challengeHash);
    assert.equal(proofChallengeParity.rows[0]?.challenge_root, proofChallengeBundle.challenge.challengeRoot);
    assert.equal(proofChallengeParity.rows[0]?.payload_hash, proofChallengeBundle.challenge.auditEvent.payloadHash);
    assert.equal(proofChallengeParity.rows[0]?.risk_source_root, proofChallengeBundle.riskSignal.sourceRoot);
    assert.equal(proofChallengeParity.rows[0]?.risk_hash, proofChallengeBundle.riskSignal.riskHash);
    assert.equal(proofChallengeParity.rows[0]?.risk_root, proofChallengeBundle.riskSignal.riskRoot);
    assert.equal(proofChallengeParity.rows[0]?.risk_payload_hash, proofChallengeBundle.riskSignal.auditEvent.payloadHash);

    const proofVerifierReviewInput = {
      decision: "uphold",
      rationale: "Independent accredited verifier confirms the contradiction materially invalidates current reliance.",
      conflictDisclosure: "No source, issuer, challenger, approver, financial, familial, employment, or operational conflict is known.",
      limitations: ["This review concerns only the immutable Environmental Proof Record."],
      sourceEventRoots: [
        proofChallengeBundle.challenge.auditEvent.eventRoot,
        proofChallengeBundle.riskSignal.auditEvent.eventRoot,
      ],
      reviewedAt: "2026-07-12T07:06:58.000Z",
    } as const;
    const proofVerifierReview = await service.reviewEnvironmentalProofChallenge(
      proofChallengeBundle.challenge.id,
      proofVerifierReviewInput,
      organizationId,
      proofChallengeVerifierId,
      "verifier",
      "environmental-proof-challenge-verifier-review",
    );
    const proofAdminReview = await service.reviewEnvironmentalProofChallenge(
      proofChallengeBundle.challenge.id,
      {
        decision: "uphold",
        rationale: "Independent administrator concurs after reviewing the exact challenge and risk authority roots.",
        conflictDisclosure: "No source, issuer, challenger, approver, financial, familial, employment, or operational conflict is known.",
        limitations: ["The review grants no credit, tax, token, funding, title, or financial authority."],
        sourceEventRoots: [
          proofChallengeBundle.challenge.auditEvent.eventRoot,
          proofChallengeBundle.riskSignal.auditEvent.eventRoot,
          proofVerifierReview.auditEvent.eventRoot,
        ],
        reviewedAt: "2026-07-12T07:06:59.000Z",
      },
      organizationId,
      proofChallengeAdminId,
      "admin",
      "environmental-proof-challenge-admin-review",
    );
    assert.equal(
      (await service.getEnvironmentalProofChallengeStatus(proofChallengeBundle.challenge.id, organizationId)).state,
      "under_review",
    );
    const reviewParity = await db.query<{
      command_hash: string;
      source_root: string;
      review_hash: string;
      review_root: string;
      payload_hash: string;
    }>(
      `SELECT
         governance.environmental_proof_challenge_review_command_hash(review) AS command_hash,
         governance.environmental_proof_challenge_review_source_root(review) AS source_root,
         governance.environmental_proof_challenge_review_hash(review) AS review_hash,
         governance.environmental_proof_challenge_review_root(review) AS review_root,
         governance.environmental_proof_challenge_review_payload_hash(review) AS payload_hash
       FROM governance.environmental_proof_challenge_reviews review
       WHERE id = $1`,
      [proofAdminReview.id],
    );
    assert.equal(reviewParity.rows[0]?.command_hash, proofAdminReview.commandHash);
    assert.equal(reviewParity.rows[0]?.source_root, proofAdminReview.sourceRoot);
    assert.equal(reviewParity.rows[0]?.review_hash, proofAdminReview.reviewHash);
    assert.equal(reviewParity.rows[0]?.review_root, proofAdminReview.reviewRoot);
    assert.equal(reviewParity.rows[0]?.payload_hash, proofAdminReview.auditEvent.payloadHash);

    const proofResolution = await service.resolveEnvironmentalProofChallenge(
      proofChallengeBundle.challenge.id,
      {
        reviewIds: [proofAdminReview.id, proofVerifierReview.id],
        decision: "uphold",
        rationale: "Independent resolver upholds the unanimous human quorum and revokes current reliance without rewriting issuance.",
        limitations: ["Revocation is an accountability state and creates no transferable or financial entitlement."],
        sourceEventRoots: [
          proofChallengeBundle.challenge.auditEvent.eventRoot,
          proofChallengeBundle.riskSignal.auditEvent.eventRoot,
          proofVerifierReview.auditEvent.eventRoot,
          proofAdminReview.auditEvent.eventRoot,
        ],
        resolvedAt: "2026-07-12T07:07:00.000Z",
      },
      organizationId,
      proofChallengeResolverId,
      "admin",
      "environmental-proof-challenge-resolution",
    );
    assert.equal(proofResolution.decision, "uphold");
    assert.equal(
      (await service.getEnvironmentalProofChallengeStatus(proofChallengeBundle.challenge.id, organizationId)).state,
      "resolved",
    );
    assert.equal((await service.getEnvironmentalProofRecordStatus(record.id, organizationId)).state, "revoked");
    const resolutionParity = await db.query<{
      command_hash: string;
      source_root: string;
      resolution_hash: string;
      resolution_root: string;
      payload_hash: string;
    }>(
      `SELECT
         governance.environmental_proof_challenge_resolution_command_hash(resolution) AS command_hash,
         governance.environmental_proof_challenge_resolution_source_root(resolution) AS source_root,
         governance.environmental_proof_challenge_resolution_hash(resolution) AS resolution_hash,
         governance.environmental_proof_challenge_resolution_root(resolution) AS resolution_root,
         governance.environmental_proof_challenge_resolution_payload_hash(resolution) AS payload_hash
       FROM governance.environmental_proof_challenge_resolutions resolution
       WHERE id = $1`,
      [proofResolution.id],
    );
    assert.equal(resolutionParity.rows[0]?.command_hash, proofResolution.commandHash);
    assert.equal(resolutionParity.rows[0]?.source_root, proofResolution.sourceRoot);
    assert.equal(resolutionParity.rows[0]?.resolution_hash, proofResolution.resolutionHash);
    assert.equal(resolutionParity.rows[0]?.resolution_root, proofResolution.resolutionRoot);
    assert.equal(resolutionParity.rows[0]?.payload_hash, proofResolution.auditEvent.payloadHash);
    const governedProjection = await db.query<{ state: string; projection_root: string }>(
      `SELECT state, projection_root
       FROM certificates.environmental_proof_governed_record_projection($1)`,
      [record.id],
    );
    const governedDomainProjection = await service.getEnvironmentalProofRecordStatus(record.id, organizationId);
    assert.equal(governedProjection.rows[0]?.state, "revoked");
    assert.equal(governedProjection.rows[0]?.projection_root, governedDomainProjection.projectionRoot);
    const challengeReconnect = new PrismaCanopyProofTrustRegistryService(pglitePrismaClient(db));
    assert.deepEqual(
      await challengeReconnect.getEnvironmentalProofChallenge(proofChallengeBundle.challenge.id, organizationId),
      proofChallengeBundle.challenge,
    );
    assert.deepEqual(
      await challengeReconnect.listEnvironmentalProofChallengeReviews(
        proofChallengeBundle.challenge.id,
        organizationId,
      ),
      [proofVerifierReview, proofAdminReview],
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [proofChallengeResolverId]);
        await transaction.query(
          "UPDATE governance.environmental_proof_challenge_resolutions SET decision = 'uphold' WHERE id = $1",
          [proofResolution.id],
        );
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [proofIssuerId]);
        await transaction.query(
          "UPDATE certificates.environmental_proof_record_facts SET status = 'issued' WHERE id = $1",
          [record.id],
        );
      }),
      /append-only/,
    );
    await assert.rejects(
      service.recordEvidenceFinalDecision(
        registration.id,
        { ...finalDecisionInput, decidedAt: "2026-07-12T07:06:31.000Z" },
        resolutionVerifierId,
        "verification-second-current-final-decision",
      ),
      /already has a current final decision/,
    );

    const challengeInput = {
      reason: "satellite_contradiction",
      severity: "high",
      rationale: "A later satellite commitment contradicts the approved bounded evidence reliance and requires independent review.",
      supportingArtifactHashes: ["e".repeat(64)],
      evidenceEventRoots: [registration.audit_history[0].eventRoot, finalDecision.auditEvent.eventRoot].sort(),
      challengedAt: "2026-07-12T07:07:00.000Z",
    } as const;
    const challenge = await service.openEvidenceChallenge(
      registration.id,
      challengeInput,
      challengerId,
      "researcher",
      challengerOrganizationId,
      "verification-evidence-challenge",
    );
    assert.equal(challenge.challengedRelianceState, "approved");
    assert.equal(challenge.challenger.organizationId, challengerOrganizationId);
    assert.equal(challenge.organizationId, organizationId);
    assert.equal(challenge.evidenceSequence, 6);
    assert.equal((await service.getEvidenceReliance(registration.id, organizationId)).state, "challenged");
    const staleProjection = await service.getEvidenceFinalVerification(registration.id, organizationId);
    assert.equal(staleProjection.state, "stale");
    const staleRecordProjection = await service.getEnvironmentalProofRecordStatus(record.id, organizationId);
    assert.equal(staleRecordProjection.state, "revoked");
    assert.equal(staleRecordProjection.baseState, "stale");
    const staleDatabaseProjection = await db.query<{
      state: string;
      source_authority_current: boolean;
      projection_root: string;
    }>(
      `SELECT state, source_authority_current, projection_root
       FROM certificates.environmental_proof_record_projection($1)`,
      [record.id],
    );
    assert.equal(staleDatabaseProjection.rows[0]?.state, "stale");
    assert.equal(staleDatabaseProjection.rows[0]?.source_authority_current, false);
    const staleGovernedDatabaseProjection = await db.query<{ state: string; projection_root: string }>(
      `SELECT state, projection_root
       FROM certificates.environmental_proof_governed_record_projection($1)`,
      [record.id],
    );
    assert.equal(staleGovernedDatabaseProjection.rows[0]?.state, "revoked");
    assert.equal(staleGovernedDatabaseProjection.rows[0]?.projection_root, staleRecordProjection.projectionRoot);
    await assertDatabaseFinalVerification(
      db,
      registration.id,
      "stale",
      finalDecision.decisionRoot,
      staleProjection.finalVerificationRoot,
    );
    assert.equal(
      (
        await service.openEvidenceChallenge(
          registration.id,
          challengeInput,
          challengerId,
          "researcher",
          challengerOrganizationId,
          "verification-evidence-challenge",
        )
      ).challengeRoot,
      challenge.challengeRoot,
    );
    await assert.rejects(
      service.getEvidenceChallenge(challenge.id, challengerOrganizationId),
      /scope mismatch/,
    );

    const resolutionInput = {
      decision: "upheld",
      rationale: "Independent accredited review upholds the contradiction and requires an append-only corrective remedy.",
      limitations: ["This resolution governs bounded reliance on the challenged evidence registration only."],
      evidenceEventRoots: [challenge.auditEvent.eventRoot],
      reviewedAt: "2026-07-12T07:08:00.000Z",
    } as const;
    await assert.rejects(
      service.resolveEvidenceChallenge(
        challenge.id,
        resolutionInput,
        verifierId,
        "verifier",
        "verification-conflicted-resolution",
      ),
      /independent human reviewer/,
    );
    const resolution = await service.resolveEvidenceChallenge(
      challenge.id,
      resolutionInput,
      resolutionVerifierId,
      "verifier",
      "verification-challenge-resolution",
    );
    assert.equal(resolution.decision, "upheld");
    assert.equal(resolution.evidenceSequence, 7);
    assert.equal((await service.getEvidenceReliance(registration.id, organizationId)).state, "correction_required");

    const correctionInput = {
      action: "withdraw",
      rationale: "Independent administration withdraws reliance while preserving the immutable evidence and review history.",
      evidenceEventRoots: [resolution.auditEvent.eventRoot],
      correctedAt: "2026-07-12T07:09:00.000Z",
    } as const;
    await assert.rejects(
      service.recordEvidenceCorrection(
        resolution.id,
        correctionInput,
        resolutionVerifierId,
        "verifier",
        "verification-conflicted-correction",
      ),
      /independent human publisher/,
    );
    const correction = await service.recordEvidenceCorrection(
      resolution.id,
      correctionInput,
      correctionAdminId,
      "admin",
      "verification-evidence-correction",
    );
    assert.equal(correction.action, "withdraw");
    assert.equal(correction.evidenceSequence, 8);
    const withdrawnReliance = await service.getEvidenceReliance(registration.id, organizationId);
    assert.equal(withdrawnReliance.state, "withdrawn");
    await assertDatabaseReliance(db, registration.id, withdrawnReliance.state, withdrawnReliance.relianceRoot);
    assert.equal((await service.listEvidenceChallenges(registration.id, organizationId)).length, 1);
    assert.equal((await service.listEvidenceChallengeResolutions(challenge.id, organizationId)).length, 1);
    assert.equal((await service.listEvidenceCorrections(registration.id, organizationId)).length, 1);
    assert.equal((await service.getEvidenceChallenge(challenge.id, organizationId)).challengeRoot, challenge.challengeRoot);
    assert.equal(
      (await service.getEvidenceChallengeResolution(resolution.id, organizationId)).resolutionRoot,
      resolution.resolutionRoot,
    );
    assert.equal((await service.getEvidenceCorrection(correction.id, organizationId)).correctionRoot, correction.correctionRoot);

    const supersededRegistration = (
      await service.registerEvidence(
        {
          id: "cp_pglite_superseded_evidence",
          projectId: project.id,
          evidenceType: "restoration",
          location: {
            latitude: 14.7168,
            longitude: -17.4678,
            accuracyMeters: 9,
            regionId: "region_verification_authority",
          },
          timestamp: "2026-07-12T07:10:00.000Z",
          createdAt: "2026-07-12T07:10:00.000Z",
          media_hash: "1a".repeat(32),
          gps_hash: "1b".repeat(32),
          confidence_score: 91,
        },
        ownerId,
        "owner",
        "verification-superseded-evidence-register",
      )
    ).evidence;
    const replacementRegistration = (
      await service.registerEvidence(
        {
          id: "cp_pglite_replacement_evidence",
          projectId: project.id,
          evidenceType: "restoration",
          location: {
            latitude: 14.7169,
            longitude: -17.4679,
            accuracyMeters: 7,
            regionId: "region_verification_authority",
          },
          timestamp: "2026-07-12T07:10:10.000Z",
          createdAt: "2026-07-12T07:10:10.000Z",
          media_hash: "2a".repeat(32),
          gps_hash: "2b".repeat(32),
          confidence_score: 94,
        },
        ownerId,
        "owner",
        "verification-replacement-evidence-register",
      )
    ).evidence;
    const supersededValidation = await service.runEvidenceValidation(
      supersededRegistration.id,
      {
        rulesetId: "canopyproof-evidence-validation-core",
        rulesetVersion: "1.0.0",
        executedAt: "2026-07-12T07:11:00.000Z",
      },
      agentId,
      "agent",
      "verification-superseded-validation",
    );
    const replacementValidation = await service.runEvidenceValidation(
      replacementRegistration.id,
      {
        rulesetId: "canopyproof-evidence-validation-core",
        rulesetVersion: "1.0.0",
        executedAt: "2026-07-12T07:11:10.000Z",
      },
      agentId,
      "agent",
      "verification-replacement-validation",
    );
    const supersededAnalysis = await service.recordEvidenceAiAnalysis(
      supersededRegistration.id,
      {
        validationRunId: supersededValidation.id,
        modelProvider: "CanopyProof Research",
        modelName: "Canopy AI Advisory",
        modelVersion: "1.0.0",
        modelArtifactHash: "3a".repeat(32),
        promptHash: "3b".repeat(32),
        datasetSnapshotRoots: ["3c".repeat(32)],
        sourceEventRoots: [
          supersededRegistration.audit_history[0].eventRoot,
          supersededValidation.auditEvent.eventRoot,
        ].sort(),
        executionEnvironment: "isolated-cpu-evaluation-v1",
        findings: [],
        confidenceScore: 87,
        analyzedAt: "2026-07-12T07:12:00.000Z",
      },
      agentId,
      "verification-superseded-analysis",
    );
    const replacementAnalysis = await service.recordEvidenceAiAnalysis(
      replacementRegistration.id,
      {
        validationRunId: replacementValidation.id,
        modelProvider: "CanopyProof Research",
        modelName: "Canopy AI Advisory",
        modelVersion: "1.0.0",
        modelArtifactHash: "4a".repeat(32),
        promptHash: "4b".repeat(32),
        datasetSnapshotRoots: ["4c".repeat(32)],
        sourceEventRoots: [
          replacementRegistration.audit_history[0].eventRoot,
          replacementValidation.auditEvent.eventRoot,
        ].sort(),
        executionEnvironment: "isolated-cpu-evaluation-v1",
        findings: [],
        confidenceScore: 90,
        analyzedAt: "2026-07-12T07:12:10.000Z",
      },
      agentId,
      "verification-replacement-analysis",
    );
    const supersededReview = await service.recordEvidenceHumanReview(
      supersededRegistration.id,
      {
        validationRunId: supersededValidation.id,
        aiAnalysisIds: [supersededAnalysis.id],
        decision: "approve",
        findingDispositions: [],
        rationale: "Independent review initially approves bounded reliance before later challenge evidence arrives.",
        limitations: ["Reliance remains bounded to the immutable source commitments."],
        reviewedAt: "2026-07-12T07:13:00.000Z",
      },
      verifierId,
      "verifier",
      "verification-superseded-review",
    );
    await service.recordEvidenceHumanReview(
      replacementRegistration.id,
      {
        validationRunId: replacementValidation.id,
        aiAnalysisIds: [replacementAnalysis.id],
        decision: "approve",
        findingDispositions: [],
        rationale: "Independent review approves the replacement on its own provenance and validation record.",
        limitations: ["Replacement approval does not rewrite or inherit the predecessor history."],
        reviewedAt: "2026-07-12T07:13:10.000Z",
      },
      verifierId,
      "verifier",
      "verification-replacement-review",
    );
    const supersessionChallenge = await service.openEvidenceChallenge(
      supersededRegistration.id,
      {
        reason: "provenance_gap",
        severity: "high",
        rationale: "A provenance gap requires replacing current reliance with separately approved evidence.",
        supportingArtifactHashes: ["5a".repeat(32)],
        evidenceEventRoots: [
          supersededRegistration.audit_history[0].eventRoot,
          supersededReview.auditEvent.eventRoot,
        ].sort(),
        challengedAt: "2026-07-12T07:14:00.000Z",
      },
      ownerId,
      "owner",
      organizationId,
      "verification-supersession-challenge",
    );
    const supersessionResolution = await service.resolveEvidenceChallenge(
      supersessionChallenge.id,
      {
        decision: "upheld",
        rationale: "Independent accredited resolution upholds the provenance gap and requires supersession.",
        limitations: ["The remedy remains an evidence-governance action, not a certificate."],
        evidenceEventRoots: [supersessionChallenge.auditEvent.eventRoot],
        reviewedAt: "2026-07-12T07:15:00.000Z",
      },
      resolutionVerifierId,
      "verifier",
      "verification-supersession-resolution",
    );
    const supersession = await service.recordEvidenceCorrection(
      supersessionResolution.id,
      {
        action: "supersede",
        replacementEvidenceId: replacementRegistration.id,
        rationale: "Independent administration links the separately approved replacement without mutating either stream.",
        evidenceEventRoots: [supersessionResolution.auditEvent.eventRoot],
        correctedAt: "2026-07-12T07:16:00.000Z",
      },
      correctionAdminId,
      "admin",
      "verification-supersession-correction",
    );
    const supersededReliance = await service.getEvidenceReliance(supersededRegistration.id, organizationId);
    assert.equal(supersession.action, "supersede");
    assert.equal(supersededReliance.state, "superseded");
    assert.equal(supersededReliance.replacementEvidenceId, replacementRegistration.id);
    const replacementReliance = await service.getEvidenceReliance(replacementRegistration.id, organizationId);
    assert.equal(replacementReliance.state, "approved");
    await assertDatabaseReliance(
      db,
      supersededRegistration.id,
      supersededReliance.state,
      supersededReliance.relianceRoot,
    );
    await assertDatabaseReliance(
      db,
      replacementRegistration.id,
      replacementReliance.state,
      replacementReliance.relianceRoot,
    );

    const staleApprovalChallenge = await service.openEvidenceChallenge(
      replacementRegistration.id,
      {
        reason: "methodology_gap",
        severity: "medium",
        rationale: "A methodology concern suspends replacement reliance while additional advisory analysis is recorded.",
        supportingArtifactHashes: ["6c".repeat(32)],
        evidenceEventRoots: [
          replacementRegistration.audit_history[0].eventRoot,
          replacementReliance.terminalEventRoot,
        ].sort(),
        challengedAt: "2026-07-12T07:17:00.000Z",
      },
      challengerId,
      "researcher",
      challengerOrganizationId,
      "verification-replacement-stale-challenge",
    );
    await service.recordEvidenceAiAnalysis(
      replacementRegistration.id,
      {
        validationRunId: replacementValidation.id,
        modelProvider: "CanopyProof Research",
        modelName: "Canopy AI Advisory",
        modelVersion: "2.0.0",
        modelArtifactHash: "6d".repeat(32),
        promptHash: "6e".repeat(32),
        datasetSnapshotRoots: ["6f".repeat(32)],
        sourceEventRoots: [
          replacementRegistration.audit_history[0].eventRoot,
          replacementValidation.auditEvent.eventRoot,
        ].sort(),
        executionEnvironment: "isolated-cpu-evaluation-v2",
        findings: [],
        confidenceScore: 89,
        analyzedAt: "2026-07-12T07:18:00.000Z",
      },
      agentId,
      "verification-replacement-post-challenge-analysis",
    );
    await service.resolveEvidenceChallenge(
      staleApprovalChallenge.id,
      {
        decision: "dismissed",
        rationale: "Independent accredited review dismisses this challenge without reviving the now-stale prior approval.",
        limitations: ["A new human review is required after the later advisory fact."],
        evidenceEventRoots: [staleApprovalChallenge.auditEvent.eventRoot],
        reviewedAt: "2026-07-12T07:19:00.000Z",
      },
      resolutionVerifierId,
      "verifier",
      "verification-replacement-stale-resolution",
    );
    const postDismissalReliance = await service.getEvidenceReliance(replacementRegistration.id, organizationId);
    assert.equal(postDismissalReliance.state, "ai_advised");
    await assertDatabaseReliance(
      db,
      replacementRegistration.id,
      postDismissalReliance.state,
      postDismissalReliance.relianceRoot,
    );

    const receipts = await db.query<{ operation: string; result_entity_id: string }>(
      `SELECT operation, result_entity_id
       FROM audit.command_receipts
       WHERE result_entity_id = ANY($1::text[])
       ORDER BY operation`,
      [[validation.id, analysis.id, review.id, finalDecision.id, challenge.id, resolution.id, correction.id]],
    );
    assert.deepEqual(
      receipts.rows.map((row) => row.operation),
      [
        "evidence.ai-analysis.record",
        "evidence.challenge.open",
        "evidence.challenge.resolve",
        "evidence.correction.record",
        "evidence.final-decision.record",
        "evidence.human-review.record",
        "evidence.validation.run",
      ],
    );

    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [agentId]);
        await transaction.query(
          "UPDATE verification.evidence_ai_analyses SET confidence_score = 100 WHERE id = $1",
          [analysis.id],
        );
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [finalVerifierId]);
        await transaction.query(
          "UPDATE verification.evidence_final_decisions SET decision = 'reject' WHERE id = $1",
          [finalDecision.id],
        );
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [ownerId]);
        await transaction.query("UPDATE verification.evidence_challenges SET severity = 'low' WHERE id = $1", [challenge.id]);
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [resolutionVerifierId]);
        await transaction.query("DELETE FROM verification.evidence_challenge_resolutions WHERE id = $1", [resolution.id]);
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [verifierId]);
        await transaction.query("DELETE FROM verification.evidence_human_reviews WHERE id = $1", [review.id]);
      }),
      /append-only/,
    );
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [agentId]);
        await transaction.query(
          `INSERT INTO verification.evidence_validation_runs (
            id, evidence_id, project_id, organization_id, evidence_root,
            ruleset_id, ruleset_version, ruleset_hash, checks, issues, outcome,
            confidence_score, executor_id, executor_snapshot, executed_at,
            command_hash, evidence_sequence, previous_event_root, validation_hash,
            validation_root, safety, audit_event_root
          ) SELECT
            'cp_validation_missing_event', evidence_id, project_id, organization_id, evidence_root,
            ruleset_id, ruleset_version, ruleset_hash, checks, issues, outcome,
            confidence_score, executor_id, executor_snapshot, executed_at,
            $2, 5, audit_event_root, $3, $4, safety, $5
          FROM verification.evidence_validation_runs WHERE id = $1`,
          [validation.id, "c".repeat(64), "d".repeat(64), "e".repeat(64), "f".repeat(64)],
        );
      }),
      /domain_events|semantic event|violates foreign key|No rows|strict/i,
    );

    const dbAuditRows = await db.query<{ table_name: string; action: string }>(
      `SELECT table_name, action FROM audit.event_log
       WHERE table_name IN (
         'evidence_validation_runs', 'evidence_ai_analyses', 'evidence_human_reviews',
         'evidence_challenges', 'evidence_challenge_resolutions', 'evidence_corrections',
         'evidence_final_decisions'
       )
       ORDER BY sequence_no`,
    );
    assert.deepEqual(
      dbAuditRows.rows.map((row) => `${row.table_name}:${row.action}`).sort(),
      [
        "evidence_ai_analyses:INSERT",
        "evidence_ai_analyses:INSERT",
        "evidence_ai_analyses:INSERT",
        "evidence_ai_analyses:INSERT",
        "evidence_challenge_resolutions:INSERT",
        "evidence_challenge_resolutions:INSERT",
        "evidence_challenge_resolutions:INSERT",
        "evidence_challenges:INSERT",
        "evidence_challenges:INSERT",
        "evidence_challenges:INSERT",
        "evidence_corrections:INSERT",
        "evidence_corrections:INSERT",
        "evidence_final_decisions:INSERT",
        "evidence_human_reviews:INSERT",
        "evidence_human_reviews:INSERT",
        "evidence_human_reviews:INSERT",
        "evidence_validation_runs:INSERT",
        "evidence_validation_runs:INSERT",
        "evidence_validation_runs:INSERT",
      ],
    );
  } finally {
    await db.close();
  }
});

test("Environmental Proof, public transparency, ESG metric, and report rollbacks remove only empty route-closed authorities", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    for (const migration of [
      "canopyproof-os.sql",
      "evidence-device-attestation-adapters.sql",
      "evidence-offline-community.sql",
      "mrv-graph.sql",
      "environmental-proof-lifecycle.sql",
      "public-transparency-authority.sql",
      "public-transparency-explorer.sql",
      "esg-metric-authority.sql",
      "esg-reporting-authority.sql",
    ]) {
      await db.exec(await readFile(join(process.cwd(), "services/api/prisma", migration), "utf8"));
    }
    await db.exec(
      await readFile(
        join(process.cwd(), "services/api/prisma/esg-reporting-authority.rollback.sql"),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        join(process.cwd(), "services/api/prisma/esg-metric-authority.rollback.sql"),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        join(process.cwd(), "services/api/prisma/public-transparency-explorer.rollback.sql"),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        join(process.cwd(), "services/api/prisma/public-transparency-authority.rollback.sql"),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        join(process.cwd(), "services/api/prisma/environmental-proof-lifecycle.rollback.sql"),
        "utf8",
      ),
    );
    const relations = await db.query<{
      signing_key_table: string | null;
      binding_table: string | null;
      signature_table: string | null;
      esg_report_table: string | null;
      esg_member_table: string | null;
      esg_metric_member_table: string | null;
      esg_metric_definition_table: string | null;
      esg_metric_result_table: string | null;
      esg_metric_source_table: string | null;
      public_query_catalog: string | null;
      public_review_table: string | null;
      public_publication_table: string | null;
    }>(`
      SELECT
        to_regclass('governance.environmental_proof_signing_key_attestation_facts')::text AS signing_key_table,
        to_regclass('certificates.environmental_proof_lifecycle_binding_facts')::text AS binding_table,
        to_regclass('certificates.environmental_proof_signature_receipt_facts')::text AS signature_table,
        to_regclass('reporting.canonical_esg_report_facts')::text AS esg_report_table,
        to_regclass('reporting.canonical_esg_report_member_facts')::text AS esg_member_table,
        to_regclass('reporting.canonical_esg_report_metric_member_facts')::text AS esg_metric_member_table,
        to_regclass('reporting.esg_metric_definition_facts')::text AS esg_metric_definition_table,
        to_regclass('reporting.esg_metric_result_facts')::text AS esg_metric_result_table,
        to_regclass('reporting.esg_metric_result_source_facts')::text AS esg_metric_source_table,
        to_regclass('transparency.public_transparency_query_catalog')::text AS public_query_catalog,
        to_regclass('transparency.public_disclosure_review_facts')::text AS public_review_table,
        to_regclass('transparency.public_transparency_publication_facts')::text AS public_publication_table
    `);
    assert.deepEqual(relations.rows[0], {
      signing_key_table: null,
      binding_table: null,
      signature_table: null,
      esg_report_table: null,
      esg_member_table: null,
      esg_metric_member_table: null,
      esg_metric_definition_table: null,
      esg_metric_result_table: null,
      esg_metric_source_table: null,
      public_query_catalog: null,
      public_review_table: null,
      public_publication_table: null,
    });
    const canonicalRecordTable = await db.query<{ record_table: string | null }>(`
      SELECT to_regclass('certificates.environmental_proof_record_facts')::text AS record_table
    `);
    assert.equal(canonicalRecordTable.rows[0]?.record_table, "certificates.environmental_proof_record_facts");
  } finally {
    await db.close();
  }
});

async function resolveMrvEndpoint(
  db: PGlite,
  type: CanopyProofMrvEndpointSnapshot["type"],
  id: string,
) {
  const result = await db.query<{ endpoint: CanopyProofMrvEndpointSnapshot }>(
    "SELECT mrv.resolve_endpoint($1, $2) AS endpoint",
    [type, id],
  );
  assert.ok(result.rows[0]?.endpoint, `MRV endpoint ${type}:${id} must resolve`);
  return result.rows[0].endpoint;
}

async function resolveMrvMethodology(db: PGlite, methodologyId: string) {
  const result = await db.query<{ methodology: CanopyProofMrvMethodologySnapshot }>(
    "SELECT mrv.resolve_methodology($1) AS methodology",
    [methodologyId],
  );
  assert.ok(result.rows[0]?.methodology, `MRV methodology ${methodologyId} must resolve`);
  return result.rows[0].methodology;
}

async function resolveMrvActor(
  db: PGlite,
  actorId: string,
  role: CanopyProofMrvActorSnapshot["role"],
): Promise<CanopyProofMrvActorSnapshot> {
  const actor = await resolveVerificationActor(db, actorId, role);
  const normalized = {
    id: actor.id,
    participantType: actor.participantType,
    role: actor.role,
    verificationStatus: actor.verificationStatus,
    organizationId: actor.organizationId,
    organizationVerificationStatus: actor.organizationVerificationStatus,
    participantRoot: actor.participantRoot,
    organizationRoot: actor.organizationRoot,
    membershipId: actor.membershipId,
    membershipStatus: actor.membershipStatus,
    membershipRoot: actor.membershipRoot,
    accreditationId: actor.accreditationId,
    accreditationStatus: actor.accreditationStatus,
    accreditationRoot: actor.accreditationRoot,
    accreditationScope: actor.accreditationScope,
  };
  return { ...normalized, authorityRoot: canopyProofMrvActorAuthorityRoot(normalized) };
}

async function resolveVerificationActor(
  db: PGlite,
  actorId: string,
  role: CanopyProofVerificationActorSnapshot["role"],
): Promise<CanopyProofVerificationActorSnapshot> {
  const result = await db.query<{
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
  }>(
    `SELECT
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
      AND membership.role = $2
      AND membership.status = 'active'
     JOIN organizations.accreditations accreditation
       ON accreditation.organization_id = organization.id
      AND accreditation.status = 'approved'
     WHERE participant.id = $1
       AND participant.participant_type = 'human'
       AND participant.verification_status = 'verified'
       AND $2 = ANY(participant.roles)
     ORDER BY accreditation.decided_at DESC, accreditation.id DESC
     LIMIT 1`,
    [actorId, role],
  );
  const row = result.rows[0];
  assert.ok(row, `verification actor ${actorId} must resolve`);
  const normalized = {
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
    ...normalized,
    authorityRoot: hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized }),
  };
}

function deterministicManagedSignatureVerifier(
  externalVerifierId: string,
): CanopyProofEnvironmentalProofManagedSignatureVerifier {
  return {
    async verifyManagedKeyAttestation(request) {
      return deterministicExternalReceipt("key-attestation", externalVerifierId, request.requestedAt, request);
    },
    async verifyDetachedSignature(request) {
      return deterministicExternalReceipt(
        "detached-signature",
        externalVerifierId,
        new Date(Date.parse(request.signedAt) + 10).toISOString(),
        request,
      );
    },
  };
}

function deterministicExternalReceipt(
  kind: string,
  externalVerifierId: string,
  verifiedAt: string,
  request: unknown,
): CanopyProofExternalVerificationReceipt {
  return {
    verified: true,
    externalVerifierId,
    providerReceiptIdHash: hashJson({ kind: `${kind}-receipt-id`, request }),
    providerReceiptHash: hashJson({ kind: `${kind}-receipt`, request }),
    verifiedAt,
  };
}

function pglitePrismaClient(db: PGlite) {
  const client = {
    async $transaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
      return db.transaction((transaction) => operation(pgliteTransactionClient(transaction)));
    },
  };
  return client as unknown as PrismaClient;
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

async function assertTriggerCatalog(db: PGlite, relation: string, expected: readonly string[]) {
  const rows = await db.query<{ tgname: string }>(
    `SELECT tgname FROM pg_trigger
     WHERE tgrelid = $1::regclass AND NOT tgisinternal
     ORDER BY tgname`,
    [relation],
  );
  assert.deepEqual(rows.rows.map((row) => row.tgname), expected);
}

async function assertDatabaseReliance(
  db: PGlite,
  evidenceId: string,
  expectedState: string,
  expectedRoot: string,
) {
  const result = await db.query<{ state: string; reliance_root: string }>(
    `SELECT
       verification.evidence_reliance_seed_at($1, MAX(event.sequence_no))->>'state' AS state,
       verification.evidence_reliance_root_at($1, MAX(event.sequence_no)) AS reliance_root
     FROM audit.domain_events event
     WHERE event.stream_id = $1`,
    [evidenceId],
  );
  assert.equal(result.rows[0]?.state, expectedState);
  assert.equal(result.rows[0]?.reliance_root, expectedRoot);
}

async function assertDatabaseFinalVerification(
  db: PGlite,
  evidenceId: string,
  expectedState: string,
  expectedLatestDecisionRoot: string,
  expectedVerificationRoot: string,
) {
  const result = await db.query<{ state: string; latest_decision_root: string; verification_root: string }>(
    `SELECT
       verification.evidence_final_verification_seed_at($1, MAX(event.sequence_no))->>'state' AS state,
       verification.evidence_final_verification_seed_at($1, MAX(event.sequence_no))->>'latestDecisionRoot'
         AS latest_decision_root,
       verification.evidence_final_verification_root_at($1, MAX(event.sequence_no)) AS verification_root
     FROM audit.domain_events event
     WHERE event.stream_id = $1`,
    [evidenceId],
  );
  assert.equal(result.rows[0]?.state, expectedState);
  assert.equal(result.rows[0]?.latest_decision_root, expectedLatestDecisionRoot);
  assert.equal(result.rows[0]?.verification_root, expectedVerificationRoot);
}

async function insertBootstrapOwner(db: PGlite, actorId: string) {
  const createdAt = "2026-07-12T06:59:00.000Z";
  const subjectHash = hashJson({ kind: "canopyproof-pglite-bootstrap-subject-v1", actorId });
  const event = appendCanopyProofAuditEvent([], {
    action: "ASSERT",
    actor: actorId,
    entityType: "identity_participant",
    entityId: actorId,
    payload: { participantType: "human", roles: ["owner"], verificationStatus: "verified", subjectHash },
    createdAt,
    rationale: "PGlite evidence-verification owner provisioned through an explicit bootstrap transaction.",
  })[0]!;
  await db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
    await transaction.query(
      `INSERT INTO identity.participants (
        id, participant_type, display_name, owner_id, roles,
        verification_status, reputation_score, credential_commitments,
        subject_hash, created_at, updated_at
      ) VALUES ($1, 'human', 'PGlite Verification Owner', $1, ARRAY['owner']::text[],
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
