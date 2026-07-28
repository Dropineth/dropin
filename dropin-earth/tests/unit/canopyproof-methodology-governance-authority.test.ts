import assert from "node:assert/strict";
import test from "node:test";
import {
  canopyProofGovernedPolicySubjects,
  CanopyProofMethodologyGovernanceAuthorityService,
  type CanopyProofGovernedPolicyAuthority,
} from "../../services/api/src/domain/canopyproof/methodology-governance-authority.js";
import { CanopyProofMethodologyRegistryService } from "../../services/api/src/domain/canopyproof/methodology-registry.js";

const governanceOrganizationId = "cp_org_methodology_governance_001";

test("project lifecycle is an explicit governed policy subject", () => {
  assert.deepEqual(canopyProofGovernedPolicySubjects, [
    "methodology_publication",
    "environmental_proof_record",
    "project_lifecycle",
  ]);
  const service = new CanopyProofMethodologyGovernanceAuthorityService();
  const creator = actor("cp_project_lifecycle_policy_creator", "human", "owner");
  const policy = service.createPolicy(
    {
      subject: "project_lifecycle",
      title: "Canonical project lifecycle human governance policy",
      requiredApprovals: 2,
      allowedReviewerRoles: ["owner", "verifier"],
      createdAt: "2026-07-19T00:00:00.000Z",
    },
    creator,
  );
  assert.equal(policy.subject, "project_lifecycle");
  assert.equal(service.getCurrentPolicy("project_lifecycle").policyRoot, policy.policyRoot);
});

function hashFor(id: string, label: string) {
  const seed = `${id}:${label}`;
  return Buffer.from(seed.repeat(Math.ceil(64 / seed.length))).toString("hex").slice(0, 64).padEnd(64, "0");
}

function actor(
  id: string,
  participantType: "human" | "agent",
  role: "agent" | "owner" | "admin" | "verifier" | "researcher",
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    id,
    participantType,
    role,
    verificationStatus: "verified",
    organizationId: governanceOrganizationId,
    organizationVerificationStatus: "verified",
    participantRoot: hashFor(id, "participant"),
    organizationRoot: hashFor(governanceOrganizationId, "organization"),
    ...(participantType === "human"
      ? {
          membershipId: `cp_membership_${id}`,
          membershipStatus: "active",
          membershipRoot: hashFor(id, "membership"),
        }
      : {}),
    accreditationScope: [],
    ...overrides,
  };
}

function accreditedVerifier(id: string, overrides: Readonly<Record<string, unknown>> = {}) {
  return actor(id, "human", "verifier", {
    accreditationId: `cp_accreditation_${id}`,
    accreditationStatus: "approved",
    accreditationRoot: hashFor(id, "accreditation"),
    accreditationScope: ["methodology publication review"],
    ...overrides,
  });
}

function methodologyPayload(
  id: string,
  input: Readonly<{ slug?: string; version?: string; supersedes?: string; createdAt?: string }> = {},
) {
  return {
    id,
    slug: input.slug ?? "bounded-environmental-proof-methodology",
    version: input.version ?? "v1.0.0",
    title: "Bounded Environmental Proof Monitoring Methodology",
    scope: "multi_scope",
    status: "draft",
    summary: "Technical methodology version for bounded evidence review, monitoring, and institutional accountability.",
    requiredDataSources: ["field_photo", "gps_trace", "governance_approval"],
    qualityGates: [
      "media_hash_required",
      "gps_hash_required",
      "duplicate_detection_required",
      "human_review_required",
      "governance_approval_required",
      "public_challenge_window_required",
      "monitoring_timeline_required",
    ],
    minimumGpsAccuracyMeters: 35,
    monitoringCadenceDays: 90,
    evidenceRetentionDays: 2_555,
    governanceApprovalIds: [],
    ...(input.supersedes ? { supersedes: input.supersedes } : {}),
    limitations: ["This technical version does not itself create publication, carbon, tax, token, or financial authority."],
    createdAt: input.createdAt ?? "2026-07-12T00:01:00.000Z",
  };
}

function createPolicy(
  service: CanopyProofMethodologyGovernanceAuthorityService,
  overrides: Readonly<Record<string, unknown>> = {},
) {
  const creator = actor("cp_methodology_policy_creator_001", "human", "owner");
  const input = {
    subject: "methodology_publication",
    title: "Independent methodology publication policy",
    requiredApprovals: 2,
    allowedReviewerRoles: ["researcher", "verifier"],
    createdAt: "2026-07-12T00:00:00.000Z",
    ...overrides,
  };
  return { policy: service.createPolicy(input, creator), input, creator };
}

function approveAndPublish(
  service: CanopyProofMethodologyGovernanceAuthorityService,
  methodologyId: string,
  policy: CanopyProofGovernedPolicyAuthority,
  suffix = "001",
) {
  const times =
    suffix === "001"
      ? {
          verifier: "2026-07-12T00:10:00.000Z",
          counterpart: "2026-07-12T00:20:00.000Z",
          publication: "2026-07-12T00:30:00.000Z",
        }
      : {
          verifier: "2026-07-12T00:50:00.000Z",
          counterpart: "2026-07-12T01:00:00.000Z",
          publication: "2026-07-12T01:10:00.000Z",
        };
  const verifier = accreditedVerifier(`cp_methodology_publication_verifier_${suffix}`);
  const verifierInput = {
    decision: "approve",
    rationale: "Independent accredited verifier approves the exact technical methodology version and policy root.",
    conflictDisclosure: "No financial, authorship, employment, familial, or operational conflict is known or undisclosed.",
    limitations: ["Approval is bounded to this immutable methodology hash."],
    sourceEventRoots: [
      service.getAuthoritySnapshot().methodologies.find((item) => item.id === methodologyId)!.auditEvent.eventRoot,
      policy.auditEvent.eventRoot,
    ],
    decidedAt: times.verifier,
  } as const;
  const verifierApproval = service.approveMethodology(methodologyId, verifierInput, verifier);
  const researcher = actor(`cp_methodology_publication_researcher_${suffix}`, "human", "researcher");
  const researcherInput = {
    decision: "approve",
    rationale: "Independent research reviewer approves publication after binding the prior accredited verifier decision.",
    conflictDisclosure: "No financial, authorship, employment, familial, or operational conflict is known or undisclosed.",
    limitations: ["Research approval does not authorize any financial or carbon-market claim."],
    sourceEventRoots: [
      service.getAuthoritySnapshot().methodologies.find((item) => item.id === methodologyId)!.auditEvent.eventRoot,
      policy.auditEvent.eventRoot,
      verifierApproval.auditEvent.eventRoot,
    ],
    decidedAt: times.counterpart,
  } as const;
  const researcherApproval = service.approveMethodology(methodologyId, researcherInput, researcher);
  const publisher = actor(`cp_methodology_publication_publisher_${suffix}`, "human", "admin");
  const publicationInput = {
    approvalIds: [researcherApproval.id, verifierApproval.id],
    rationale: "Independent publisher records the complete human quorum for this bounded methodology authority.",
    limitations: ["Publication remains subject to supersession, challenge, and continuing governance review."],
    sourceEventRoots: [
      service.getAuthoritySnapshot().methodologies.find((item) => item.id === methodologyId)!.auditEvent.eventRoot,
      policy.auditEvent.eventRoot,
      verifierApproval.auditEvent.eventRoot,
      researcherApproval.auditEvent.eventRoot,
    ],
    publishedAt: times.publication,
  } as const;
  const publication = service.publishMethodology(methodologyId, publicationInput, publisher);
  return {
    verifier,
    verifierInput,
    verifierApproval,
    researcher,
    researcherInput,
    researcherApproval,
    publisher,
    publicationInput,
    publication,
  };
}

test("CanopyProof creates and replays governed policy and methodology publication authority", () => {
  const methodologyRegistry = new CanopyProofMethodologyRegistryService();
  const methodology = methodologyRegistry.createMethodology(
    methodologyPayload("cp_methodology_governed_publication_001"),
    "cp_methodology_technical_author_001",
  );
  const service = new CanopyProofMethodologyGovernanceAuthorityService([methodology]);
  const { policy, input: policyInput, creator } = createPolicy(service);
  assert.equal(service.createPolicy(policyInput, creator), policy);
  assert.equal(policy.requiredApprovals, 2);
  assert.equal(policy.safety.aiIsNeverFinalAuthority, true);

  const authority = approveAndPublish(service, methodology.id, policy);
  assert.equal(service.approveMethodology(methodology.id, authority.verifierInput, authority.verifier), authority.verifierApproval);
  assert.equal(service.approveMethodology(methodology.id, authority.researcherInput, authority.researcher), authority.researcherApproval);
  assert.equal(
    service.publishMethodology(methodology.id, authority.publicationInput, authority.publisher),
    authority.publication,
  );
  const projection = service.getPublicationProjection(methodology.id);
  assert.equal(projection.state, "published");
  const bundle = service.getCurrentPublicationBundle(methodology.id);
  assert.equal(bundle.publication.id, authority.publication.id);
  assert.equal(bundle.approvals.length, 2);
  assert.equal(bundle.publication.safety.notCertifiedCarbonCredit, true);

  const replayed = CanopyProofMethodologyGovernanceAuthorityService.fromAuthoritySnapshot(service.getAuthoritySnapshot());
  assert.deepEqual(replayed.getCurrentPublicationBundle(methodology.id), bundle);
  assert.deepEqual(replayed.getCurrentPolicy("methodology_publication"), policy);
});

test("CanopyProof methodology publication rejects Agent, author, stale accreditation, incomplete quorum, and self-publication", () => {
  const methodologyRegistry = new CanopyProofMethodologyRegistryService();
  const methodology = methodologyRegistry.createMethodology(
    methodologyPayload("cp_methodology_governance_denials_001"),
    "cp_methodology_technical_author_denied",
  );
  const service = new CanopyProofMethodologyGovernanceAuthorityService([methodology]);
  const { policy } = createPolicy(service);
  const baseInput = {
    decision: "approve",
    rationale: "Independent reviewer evaluates the exact technical version and publication policy authority.",
    conflictDisclosure: "No financial, authorship, employment, familial, or operational conflict is known or undisclosed.",
    sourceEventRoots: [methodology.auditEvent.eventRoot, policy.auditEvent.eventRoot],
    decidedAt: "2026-07-12T00:10:00.000Z",
  } as const;
  assert.throws(
    () => service.approveMethodology(methodology.id, baseInput, actor("cp_methodology_agent_denied", "agent", "agent")),
    /active human organization authority/,
  );
  assert.throws(
    () => service.approveMethodology(methodology.id, baseInput, actor(methodology.createdBy, "human", "researcher")),
    /independence from the methodology author/,
  );
  assert.throws(
    () => service.approveMethodology(methodology.id, baseInput, actor("cp_methodology_unaccredited", "human", "verifier")),
    /current approved accreditation/,
  );
  const verifier = service.approveMethodology(
    methodology.id,
    baseInput,
    accreditedVerifier("cp_methodology_single_verifier"),
  );
  assert.throws(
    () =>
      service.publishMethodology(
        methodology.id,
        {
          approvalIds: [verifier.id, "cp_missing_methodology_approval"],
          rationale: "Publication cannot proceed without the complete independent human governance quorum.",
          sourceEventRoots: [methodology.auditEvent.eventRoot, policy.auditEvent.eventRoot, verifier.auditEvent.eventRoot],
          publishedAt: "2026-07-12T00:30:00.000Z",
        },
        actor("cp_methodology_incomplete_publisher", "human", "admin"),
      ),
    /complete approval set/,
  );
});

test("CanopyProof successor publication and policy authority make prior publication non-current", () => {
  const methodologyRegistry = new CanopyProofMethodologyRegistryService();
  const first = methodologyRegistry.createMethodology(
    methodologyPayload("cp_methodology_governance_v1"),
    "cp_methodology_author_v1",
  );
  const second = methodologyRegistry.createMethodology(
    methodologyPayload("cp_methodology_governance_v2", {
      version: "v2.0.0",
      supersedes: first.id,
      createdAt: "2026-07-12T00:40:00.000Z",
    }),
    "cp_methodology_author_v2",
  );
  const service = new CanopyProofMethodologyGovernanceAuthorityService([first, second]);
  const { policy } = createPolicy(service);
  approveAndPublish(service, first.id, policy, "001");
  approveAndPublish(service, second.id, policy, "002");
  assert.equal(service.getPublicationProjection(first.id).state, "superseded");
  assert.equal(service.getPublicationProjection(second.id).state, "published");
  assert.throws(() => service.getCurrentPublicationBundle(first.id), /not current/);

  const policySuccessor = service.createPolicy(
    {
      subject: "methodology_publication",
      title: "Independent methodology publication policy successor",
      requiredApprovals: 3,
      allowedReviewerRoles: ["admin", "researcher", "verifier"],
      supersedesPolicyId: policy.id,
      createdAt: "2026-07-12T01:20:00.000Z",
    },
    actor("cp_methodology_policy_successor_creator", "human", "owner"),
  );
  assert.equal(service.getCurrentPolicy("methodology_publication"), policySuccessor);
  assert.equal(service.getPublicationProjection(second.id).state, "superseded");
});

test("CanopyProof methodology governance snapshot rejects policy, approval, and publication tampering", () => {
  const methodologyRegistry = new CanopyProofMethodologyRegistryService();
  const methodology = methodologyRegistry.createMethodology(
    methodologyPayload("cp_methodology_governance_replay_001"),
    "cp_methodology_author_replay",
  );
  const service = new CanopyProofMethodologyGovernanceAuthorityService([methodology]);
  const { policy } = createPolicy(service);
  const authority = approveAndPublish(service, methodology.id, policy);
  const snapshot = service.getAuthoritySnapshot();
  assert.throws(
    () =>
      CanopyProofMethodologyGovernanceAuthorityService.fromAuthoritySnapshot({
        ...snapshot,
        policies: [{ ...policy, requiredApprovals: 1 }],
      }),
    /minimum|constitutional|lineage|invalid/i,
  );
  assert.throws(
    () =>
      CanopyProofMethodologyGovernanceAuthorityService.fromAuthoritySnapshot({
        ...snapshot,
        approvals: [{ ...authority.verifierApproval, rationale: "Tampered approval rationale." }, authority.researcherApproval],
      }),
    /canonical|lineage|invalid/i,
  );
  assert.throws(
    () =>
      CanopyProofMethodologyGovernanceAuthorityService.fromAuthoritySnapshot({
        ...snapshot,
        publications: [{ ...authority.publication, rationale: "Tampered publication rationale." }],
      }),
    /canonical|lineage|conflicting|invalid/i,
  );
});
