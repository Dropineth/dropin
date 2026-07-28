import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import {
  CanopyProofRootGovernanceAuthorityService,
  canopyProofRootGovernanceScopes,
  normalizeRootGovernanceMember,
  rootGovernanceAttestationSigningBytes,
  type CanopyProofRootGovernanceMember,
  type CanopyProofRootGovernanceProposalFact,
} from "../../services/api/src/domain/canopyproof/root-governance-authority.js";

type CouncilSigner = Readonly<{
  member: CanopyProofRootGovernanceMember;
  privateKey: CryptoKey;
}>;

test("three independent signed council approvals activate and replay deterministic root governance", async () => {
  const council = await buildCouncil("initial", 3);
  const first = new CanopyProofRootGovernanceAuthorityService();
  const second = new CanopyProofRootGovernanceAuthorityService();
  const input = initialProposalInput(council);
  const firstProposal = first.propose(input, council[0]!.member);
  const secondProposal = second.propose(input, council[0]!.member);
  assert.equal(firstProposal.proposalRoot, secondProposal.proposalRoot);

  const firstApprovals = [];
  const secondApprovals = [];
  for (const [index, signer] of council.entries()) {
    const attestedAt = `2026-07-19T0${index + 1}:00:00.000Z`;
    const signatureBase64Url = await signProposal(firstProposal, signer, attestedAt);
    firstApprovals.push(
      await first.attest(firstProposal.id, attestationInput(attestedAt, signatureBase64Url), signer.member),
    );
    secondApprovals.push(
      await second.attest(secondProposal.id, attestationInput(attestedAt, signatureBase64Url), signer.member),
    );
  }
  const decisionInput = {
    approvalAttestationIds: firstApprovals.map((approval) => approval.id),
    decidedAt: "2026-07-19T04:00:00.000Z",
  };
  const firstDecision = first.decide(firstProposal.id, decisionInput);
  const secondDecision = second.decide(secondProposal.id, {
    ...decisionInput,
    approvalAttestationIds: secondApprovals.map((approval) => approval.id),
  });
  assert.equal(firstDecision.decisionRoot, secondDecision.decisionRoot);
  assert.equal(firstDecision.approvalQuorumRoot, secondDecision.approvalQuorumRoot);
  assert.equal(first.decide(firstProposal.id, { ...decisionInput, id: firstDecision.id }), firstDecision);

  const projection = first.getProjection("2026-07-20T00:00:00.000Z");
  assert.equal(projection.status, "active");
  assert.equal(projection.policyRoot, policyRoot);
  assert.deepEqual(projection.delegatedScopes, [...canopyProofRootGovernanceScopes]);
  assert.equal(first.getProjection("2027-07-19T00:00:00.000Z").status, "expired");

  const replayed = await CanopyProofRootGovernanceAuthorityService.fromAuthoritySnapshot(
    first.getAuthoritySnapshot(),
  );
  assert.deepEqual(replayed.getProjection("2026-07-20T00:00:00.000Z"), projection);
  assert.deepEqual(first.getStatus(), {
    service: "canopyproof-root-governance-authority",
    routeMounted: false,
    schedulerMounted: false,
    productionActivationEnabled: false,
    publicBootstrapEndpoint: false,
    privateKeyHandling: false,
    compatibilityAuthorityFallback: false,
    appendOnly: true,
    exactRetryRequired: true,
    explicitAsOfRequired: true,
    minimumIndependentOrganizations: 3,
    delegatedScopes: [...canopyProofRootGovernanceScopes],
  });
});

test("root governance rejects weak quorum, duplicate organizations, private keys, and signature substitution", async () => {
  const council = await buildCouncil("adversarial", 3);
  const service = new CanopyProofRootGovernanceAuthorityService();
  const proposal = service.propose(initialProposalInput(council), council[0]!.member);
  const approvals = [];
  for (let index = 0; index < 2; index += 1) {
    const signer = council[index]!;
    const attestedAt = `2026-07-19T0${index + 1}:00:00.000Z`;
    approvals.push(
      await service.attest(
        proposal.id,
        attestationInput(attestedAt, await signProposal(proposal, signer, attestedAt)),
        signer.member,
      ),
    );
  }
  assert.throws(
    () =>
      service.decide(proposal.id, {
        approvalAttestationIds: approvals.map((approval) => approval.id),
        decidedAt: "2026-07-19T03:00:00.000Z",
      }),
    /QUORUM_INCOMPLETE/,
  );

  const substitutedTime = "2026-07-19T03:00:00.000Z";
  const wrongSignature = await signProposal(proposal, council[0]!, substitutedTime);
  await assert.rejects(
    service.attest(proposal.id, attestationInput(substitutedTime, wrongSignature), council[2]!.member),
    /SIGNATURE_INVALID/,
  );

  const duplicateOrganizationCouncil = [
    council[0]!,
    council[1]!,
    {
      ...council[2]!,
      member: normalizeRootGovernanceMember({
        ...memberSeed(council[2]!.member),
        organizationId: council[1]!.member.organizationId,
        organizationRoot: council[1]!.member.organizationRoot,
      }),
    },
  ];
  assert.throws(
    () =>
      new CanopyProofRootGovernanceAuthorityService().propose(
        initialProposalInput(duplicateOrganizationCouncil),
        duplicateOrganizationCouncil[0]!.member,
      ),
    /ORGANIZATION_DUPLICATE/,
  );

  assert.throws(
    () =>
      normalizeRootGovernanceMember({
        ...memberSeed(council[0]!.member),
        publicKeyJwk: { ...council[0]!.member.publicKeyJwk, d: "forbidden-private-key-material" },
      }),
    /PRIVATE_MATERIAL_FORBIDDEN/,
  );
  assert.throws(
    () =>
      new CanopyProofRootGovernanceAuthorityService().propose(
        { ...initialProposalInput(council), delegatedScopes: canopyProofRootGovernanceScopes.slice(1) },
        council[0]!.member,
      ),
    /SCOPE_INVALID/,
  );
});

test("successor requires old and new council quorums", async () => {
  const oldCouncil = await buildCouncil("old", 3);
  const newCouncil = await buildCouncil("new", 3);
  const service = new CanopyProofRootGovernanceAuthorityService();
  const initial = await activateInitial(service, oldCouncil);
  const successor = service.propose(
    {
      ...initialProposalInput(newCouncil),
      action: "supersede",
      charterVersion: "v2.0.0",
      predecessorDecisionId: initial.decisionId,
      targetDecisionId: initial.decisionId,
      reasonCode: "scheduled_succession",
      rationale: "The outgoing council proposes a bounded successor charter with independently committed members.",
      proposedAt: "2026-08-01T00:00:00.000Z",
      requestedValidUntil: "2027-07-31T00:00:00.000Z",
    },
    oldCouncil[0]!.member,
  );

  const newApprovals = await attestCouncil(service, successor, newCouncil, "2026-08-01", 1);
  assert.throws(
    () =>
      service.decide(successor.id, {
        approvalAttestationIds: newApprovals.map((approval) => approval.id),
        decidedAt: "2026-08-01T10:00:00.000Z",
      }),
    /PREDECESSOR_COUNCIL_QUORUM_INCOMPLETE/,
  );
  const oldApprovals = await attestCouncil(service, successor, oldCouncil, "2026-08-01", 4);
  const decision = service.decide(successor.id, {
    approvalAttestationIds: [...newApprovals, ...oldApprovals].map((approval) => approval.id),
    decidedAt: "2026-08-01T10:00:00.000Z",
  });
  const projection = service.getProjection("2026-08-02T00:00:00.000Z");
  assert.equal(projection.status, "active");
  assert.equal(projection.charterVersion, "v2.0.0");
  assert.equal(projection.charterDecisionId, decision.id);
});

test("suspension, governed recovery, and terminal revocation never revive an older charter", async () => {
  const council = await buildCouncil("control", 3);
  const service = new CanopyProofRootGovernanceAuthorityService();
  const initial = await activateInitial(service, council);
  const suspension = service.propose(
    controlProposalInput("suspend", initial.decisionId, initial.decisionId, "2026-08-01T00:00:00.000Z"),
    council[0]!.member,
  );
  const suspensionApprovals = await attestCouncil(service, suspension, council, "2026-08-01", 1);
  const suspensionDecision = service.decide(suspension.id, {
    approvalAttestationIds: suspensionApprovals.map((approval) => approval.id),
    decidedAt: "2026-08-01T05:00:00.000Z",
  });
  assert.equal(service.getProjection("2026-08-01T06:00:00.000Z").status, "suspended");

  const recovery = service.propose(
    {
      ...initialProposalInput(council),
      action: "supersede",
      charterVersion: "v1.1.0",
      predecessorDecisionId: suspensionDecision.id,
      targetDecisionId: initial.decisionId,
      reasonCode: "policy_transition",
      rationale: "The same independent council adopts a new bounded charter after resolving the suspension cause.",
      proposedAt: "2026-08-02T00:00:00.000Z",
      requestedValidUntil: "2027-08-01T00:00:00.000Z",
    },
    council[0]!.member,
  );
  const recoveryApprovals = await attestCouncil(service, recovery, council, "2026-08-02", 1);
  const recoveryDecision = service.decide(recovery.id, {
    approvalAttestationIds: recoveryApprovals.map((approval) => approval.id),
    decidedAt: "2026-08-02T05:00:00.000Z",
  });
  assert.equal(service.getProjection("2026-08-02T06:00:00.000Z").status, "active");

  const revocation = service.propose(
    controlProposalInput("revoke", recoveryDecision.id, recoveryDecision.id, "2026-08-03T00:00:00.000Z"),
    council[0]!.member,
  );
  const revocationApprovals = await attestCouncil(service, revocation, council, "2026-08-03", 1);
  service.decide(revocation.id, {
    approvalAttestationIds: revocationApprovals.map((approval) => approval.id),
    decidedAt: "2026-08-03T05:00:00.000Z",
  });
  assert.equal(service.getProjection("2026-08-03T06:00:00.000Z").status, "revoked");
  assert.throws(
    () =>
      service.propose(
        {
          ...initialProposalInput(council),
          action: "supersede",
          charterVersion: "v1.2.0",
          predecessorDecisionId: revocation.id,
          targetDecisionId: recoveryDecision.id,
          reasonCode: "scheduled_succession",
          rationale: "This proposal must fail because terminal revocation cannot be bypassed by succession.",
          proposedAt: "2026-08-04T00:00:00.000Z",
          requestedValidUntil: "2027-08-03T00:00:00.000Z",
        },
        council[0]!.member,
      ),
    /REVOKED_TERMINAL/,
  );
});

test("snapshot replay rejects signature and policy tampering", async () => {
  const council = await buildCouncil("tamper", 3);
  const service = new CanopyProofRootGovernanceAuthorityService();
  await activateInitial(service, council);

  const signatureTamper = structuredClone(service.getAuthoritySnapshot());
  const attestation = signatureTamper.attestationFacts[0]!;
  (attestation as { signatureBase64Url: string }).signatureBase64Url =
    `${attestation.signatureBase64Url.startsWith("A") ? "B" : "A"}${attestation.signatureBase64Url.slice(1)}`;
  await assert.rejects(
    CanopyProofRootGovernanceAuthorityService.fromAuthoritySnapshot(signatureTamper),
    /SIGNATURE_INVALID|REPLAY_INVALID/,
  );

  const policyTamper = structuredClone(service.getAuthoritySnapshot());
  (policyTamper.proposalFacts[0] as { policyRoot: string }).policyRoot = root("tampered-policy");
  await assert.rejects(
    CanopyProofRootGovernanceAuthorityService.fromAuthoritySnapshot(policyTamper),
    /REPLAY_INVALID|ID_INVALID/,
  );
});

async function activateInitial(service: CanopyProofRootGovernanceAuthorityService, council: readonly CouncilSigner[]) {
  const proposal = service.propose(initialProposalInput(council), council[0]!.member);
  const approvals = await attestCouncil(service, proposal, council, "2026-07-19", 1);
  const decision = service.decide(proposal.id, {
    approvalAttestationIds: approvals.map((approval) => approval.id),
    decidedAt: "2026-07-19T05:00:00.000Z",
  });
  return { proposal, approvals, decision, decisionId: decision.id };
}

async function attestCouncil(
  service: CanopyProofRootGovernanceAuthorityService,
  proposal: CanopyProofRootGovernanceProposalFact,
  council: readonly CouncilSigner[],
  date: string,
  hourOffset: number,
) {
  const approvals = [];
  for (const [index, signer] of council.entries()) {
    const hour = String(hourOffset + index).padStart(2, "0");
    const attestedAt = `${date}T${hour}:00:00.000Z`;
    approvals.push(
      await service.attest(
        proposal.id,
        attestationInput(attestedAt, await signProposal(proposal, signer, attestedAt)),
        signer.member,
      ),
    );
  }
  return approvals;
}

function initialProposalInput(council: readonly CouncilSigner[]) {
  return {
    action: "activate_initial" as const,
    charterVersion: "v1.0.0",
    charterDocumentRoot: root("root-governance-charter-v1"),
    policyRoot,
    delegatedScopes: [...canopyProofRootGovernanceScopes],
    councilMembers: council.map((signer) => signer.member),
    requiredApprovals: 3,
    requestedValidUntil: "2027-07-19T00:00:00.000Z",
    reasonCode: "initial_constitution" as const,
    rationale: "Three independent institutions propose a bounded charter for accreditation bootstrap only.",
    evidenceEventRoots: [root("charter-legal-review"), root("charter-security-review")],
    proposedAt: "2026-07-19T00:00:00.000Z",
  };
}

function controlProposalInput(
  action: "suspend" | "revoke",
  predecessorDecisionId: string,
  targetDecisionId: string,
  proposedAt: string,
) {
  return {
    action,
    predecessorDecisionId,
    targetDecisionId,
    reasonCode: action === "suspend" ? ("authority_compromise" as const) : ("governance_failure" as const),
    rationale:
      action === "suspend"
        ? "Independent council members suspend root authority while a documented compromise is investigated."
        : "Independent council members permanently revoke the root authority after a documented governance failure.",
    evidenceEventRoots: [root(`${action}-evidence`)],
    proposedAt,
  };
}

function attestationInput(attestedAt: string, signatureBase64Url: string) {
  return {
    decision: "approve" as const,
    rationale: "The signer independently approves the exact proposal root and accepts the bounded delegation.",
    conflictDisclosure: "The signer reports no employment, ownership, funding, family, or advisory conflict.",
    attestedAt,
    signatureBase64Url,
  };
}

async function signProposal(
  proposal: CanopyProofRootGovernanceProposalFact,
  signer: CouncilSigner,
  attestedAt: string,
) {
  const signature = await crypto.subtle.sign(
    { name: "Ed25519" },
    signer.privateKey,
    rootGovernanceAttestationSigningBytes({
      proposalRoot: proposal.proposalRoot,
      decision: "approve",
      signerMemberRoot: signer.member.memberRoot,
      attestedAt,
    }),
  );
  return base64Url(new Uint8Array(signature));
}

async function buildCouncil(prefix: string, count: number): Promise<readonly CouncilSigner[]> {
  return Promise.all(
    Array.from({ length: count }, async (_value, index) => {
      const participantId = `${prefix}-member-${index + 1}`;
      const organizationId = `${prefix}-organization-${index + 1}`;
      const keyPair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
      const exported = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
      const publicKeyJwk = {
        kty: "OKP" as const,
        crv: "Ed25519" as const,
        x: exported.x!,
        key_ops: ["verify"] as const,
        ext: true as const,
      };
      return {
        member: normalizeRootGovernanceMember({
          participantId,
          participantRoot: root(`participant:${participantId}`),
          role: index === 0 ? "admin" : index === 1 ? "verifier" : "researcher",
          verificationStatus: "verified",
          organizationId,
          organizationRoot: root(`organization:${organizationId}`),
          organizationVerificationStatus: "verified",
          membershipId: `membership-${participantId}`,
          membershipRoot: root(`membership:${participantId}`),
          membershipStatus: "active",
          keyId: `ed25519-${participantId}`,
          publicKeyJwk,
        }),
        privateKey: keyPair.privateKey,
      };
    }),
  );
}

function memberSeed(member: CanopyProofRootGovernanceMember) {
  return {
    participantId: member.participantId,
    participantRoot: member.participantRoot,
    role: member.role,
    verificationStatus: member.verificationStatus,
    organizationId: member.organizationId,
    organizationRoot: member.organizationRoot,
    organizationVerificationStatus: member.organizationVerificationStatus,
    membershipId: member.membershipId,
    membershipRoot: member.membershipRoot,
    membershipStatus: member.membershipStatus,
    keyId: member.keyId,
    publicKeyJwk: member.publicKeyJwk,
  };
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function root(label: string) {
  return hashJson({ kind: "canopyproof-root-governance-test-root", label });
}

const policyRoot = root("organization-accreditation-policy-v1");
