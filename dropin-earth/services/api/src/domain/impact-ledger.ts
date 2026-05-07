import { evidenceHash, hashJson, merkleRoot } from "@dropin/crypto";
import {
  createChallengeSchema,
  createImpactCertificateSchema,
  evidenceUploadSchema,
  projectSchema,
  type ChallengeCase,
  type EvidenceObject,
  type ImpactCertificate,
  type Project,
} from "@dropin/schemas";
import { id, InMemoryRepository, nowIso } from "./repository.js";

export class ImpactLedger {
  constructor(private readonly repo: InMemoryRepository) {}

  createProject(input: unknown, actor = "admin") {
    const parsed = projectSchema
      .omit({ id: true, createdAt: true, updatedAt: true })
      .parse(input);
    const createdAt = nowIso();
    const project: Project = {
      ...parsed,
      id: id("project"),
      createdAt,
      updatedAt: createdAt,
    };

    this.repo.projects.set(project.id, project);
    this.repo.addAuditLog({
      actor,
      action: "project.create",
      entityType: "project",
      entityId: project.id,
      afterState: project,
    });
    return project;
  }

  uploadEvidence(input: unknown) {
    const parsed = evidenceUploadSchema.parse(input);
    const createdAt = nowIso();
    const evidence: EvidenceObject = {
      projectId: parsed.projectId,
      treeClusterId: parsed.treeClusterId,
      kind: parsed.kind,
      uri: parsed.uri,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      submittedBy: parsed.submittedBy,
      id: id("evidence"),
      sha256Hash: parsed.contentHash ?? evidenceHash(parsed.rawContent ?? parsed.content ?? "", parsed.uri),
      status: "hashed",
      createdAt,
      updatedAt: createdAt,
    };

    this.repo.evidenceObjects.set(evidence.id, evidence);
    return evidence;
  }

  issueImpactCertificate(input: unknown, actor = "admin") {
    const parsed = createImpactCertificateSchema.parse(input);
    const project = this.repo.projects.get(parsed.projectId);
    if (!project) {
      throw new Error(`Project not found: ${parsed.projectId}`);
    }

    const evidenceIds = parsed.evidenceIds ?? parsed.evidenceObjectIds ?? [];
    const evidenceObjects = evidenceIds.map((evidenceId) => {
      const evidence = this.repo.evidenceObjects.get(evidenceId);
      if (!evidence) {
        throw new Error(`Evidence object not found: ${evidenceId}`);
      }
      return evidence;
    });
    const evidenceRoot = merkleRoot(evidenceObjects.map((evidence) => evidence.sha256Hash));
    const confidenceScore = Math.round(parsed.survivalRateEstimate * 100);
    const createdAt = nowIso();
    const certificate: ImpactCertificate = {
      ...parsed,
      id: id("impactcert"),
      regionId: project.regionId,
      certificateLevel: "impact_certificate",
      evidenceRoot,
      confidenceScore,
      status: "issued",
      issuedAt: createdAt,
      createdAt,
    };

    this.repo.impactCertificates.set(certificate.id, certificate);
    this.repo.addAuditLog({
      actor,
      action: "impact_certificate.issue",
      entityType: "impact_certificate",
      entityId: certificate.id,
      afterState: certificate,
    });
    return certificate;
  }

  submitChallenge(input: unknown) {
    const parsed = createChallengeSchema.parse(input);
    const createdAt = nowIso();
    const challenge: ChallengeCase = {
      ...parsed,
      id: id("challenge"),
      status: "submitted",
      result: "pending",
      rewardAmount: "0",
      createdAt,
      updatedAt: createdAt,
    };

    this.repo.challenges.set(challenge.id, challenge);
    this.markTargetChallenged(challenge);
    return challenge;
  }

  private markTargetChallenged(challenge: ChallengeCase) {
    if (challenge.targetType === "impact_certificate") {
      const certificate = this.repo.impactCertificates.get(challenge.targetId);
      if (!certificate) {
        return;
      }

      const updated: ImpactCertificate = {
        ...certificate,
        status: "challenged",
      };
      this.repo.impactCertificates.set(certificate.id, updated);
    }
  }
}

export function certificateDisclosure(certificate: ImpactCertificate) {
  return {
    ...certificate,
    claimBoundary:
      "Impact Certificate only. This is not a certified carbon credit and cannot support offset or tax claims until MRV and retirement requirements are met.",
    certificateHash: hashJson(certificate),
  };
}
