import { createChallengeSchema, createImpactCertificateSchema } from "@dropin/schemas";
import type { ChallengeCase, ImpactCertificate } from "@dropin/schemas";
import { computeCertificateHash, computeEvidenceRoot, mockValidatorSignature } from "./impact-engine.js";
import {
  CertificateNotFoundError,
  EvidenceNotAcceptedError,
  EvidenceNotFoundError,
  ProjectNotFoundError,
} from "./impact-errors.js";
import type { ImpactRepository } from "./impact-repository.js";

export class CertificateService {
  constructor(private readonly repo: ImpactRepository) {}

  async issueCertificate(input: unknown, actor = "api-admin") {
    const parsed = createImpactCertificateSchema.parse(input);
    const evidenceIds = parsed.evidenceIds ?? parsed.evidenceObjectIds ?? [];
    const project = await this.repo.getProject(parsed.projectId);
    if (!project) {
      throw new ProjectNotFoundError(parsed.projectId);
    }

    const evidenceObjects = [];
    for (const evidenceId of evidenceIds) {
      const evidence = await this.repo.getEvidence(evidenceId);
      if (!evidence) {
        throw new EvidenceNotFoundError(evidenceId);
      }
      if (evidence.status !== "accepted") {
        throw new EvidenceNotAcceptedError(evidenceId);
      }
      evidenceObjects.push(evidence);
    }

    const now = this.repo.now();
    const certificate: ImpactCertificate = {
      id: this.repo.makeId("cert"),
      projectId: parsed.projectId,
      treeClusterId: parsed.treeClusterId,
      regionId: project.regionId,
      evidenceObjectIds: evidenceIds,
      certificateLevel: "impact_certificate",
      evidenceRoot: computeEvidenceRoot(evidenceObjects),
      methodologyVersion: parsed.methodologyVersion,
      verifiedTreeCount: parsed.verifiedTreeCount,
      survivalRateEstimate: parsed.survivalRateEstimate,
      estimatedCo2eLow: parsed.estimatedCo2eLow,
      estimatedCo2eHigh: parsed.estimatedCo2eHigh,
      confidenceScore: Math.round(parsed.survivalRateEstimate * 100),
      validatorSignatures: parsed.validatorSignatures,
      status: "issued",
      issuedAt: now,
      createdAt: now,
    };

    if (certificate.validatorSignatures.length === 0) {
      certificate.validatorSignatures = [mockValidatorSignature(certificate)];
    }

    const created = await this.repo.createCertificate({
      ...certificate,
      evidenceIds,
    });
    await this.repo.createAuditLog({
      actor,
      action: "impact_certificate.issue",
      entityType: "impact_certificate",
      entityId: created.id,
      afterState: {
        ...created,
        certificateHash: computeCertificateHash(created),
      },
    });
    return created;
  }

  async getCertificate(certificateId: string) {
    const certificate = await this.repo.getCertificate(certificateId);
    if (!certificate) {
      throw new CertificateNotFoundError(certificateId);
    }
    return certificate;
  }

  listCertificates() {
    return this.repo.listCertificates();
  }

  async challengeCertificate(certificateId: string, input: unknown) {
    const certificate = await this.getCertificate(certificateId);
    const parsed = createChallengeSchema.parse({
      targetType: "impact_certificate",
      targetId: certificateId,
      ...(typeof input === "object" && input !== null ? input : {}),
    });
    const challengeInput: Omit<ChallengeCase, "id" | "createdAt" | "updatedAt"> = {
      ...parsed,
      status: "submitted",
      result: "pending",
      rewardAmount: "0",
    };
    const challenge = await this.repo.createChallenge(challengeInput);
    const updated = await this.repo.updateCertificateStatus(certificateId, "challenged");
    await this.repo.createAuditLog({
      actor: parsed.challenger,
      action: "impact_certificate.challenge",
      entityType: "impact_certificate",
      entityId: certificateId,
      beforeState: certificate,
      afterState: {
        certificate: updated,
        challenge,
      },
    });
    return {
      challenge,
      certificate: updated,
    };
  }
}
