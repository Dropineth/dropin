import { evidenceReviewSchema, evidenceUploadSchema } from "@dropin/schemas";
import type { EvidenceObject } from "@dropin/schemas";
import { computeEvidenceHash } from "./impact-engine.js";
import { EvidenceNotFoundError, ProjectNotFoundError } from "./impact-errors.js";
import type { ImpactRepository } from "./impact-repository.js";

export class EvidenceService {
  constructor(private readonly repo: ImpactRepository) {}

  async uploadEvidence(input: unknown) {
    const parsed = evidenceUploadSchema.parse(input);
    const project = await this.repo.getProject(parsed.projectId);
    if (!project) {
      throw new ProjectNotFoundError(parsed.projectId);
    }

    const evidence: Omit<EvidenceObject, "id" | "createdAt" | "updatedAt"> = {
      projectId: parsed.projectId,
      treeClusterId: parsed.treeClusterId,
      kind: parsed.kind,
      uri: parsed.uri,
      sha256Hash: computeEvidenceHash({
        uri: parsed.uri,
        rawContent: parsed.rawContent,
        content: parsed.content,
        contentHash: parsed.contentHash,
      }),
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      submittedBy: parsed.submittedBy,
      status: parsed.contentHash ? "uploaded" : "hashed",
    };

    return this.repo.createEvidence({
      ...evidence,
      status: evidence.status,
    });
  }

  async getEvidence(evidenceId: string) {
    const evidence = await this.repo.getEvidence(evidenceId);
    if (!evidence) {
      throw new EvidenceNotFoundError(evidenceId);
    }
    return evidence;
  }

  listEvidence() {
    return this.repo.listEvidence();
  }

  async reviewEvidence(evidenceId: string, input: unknown, actor = "api-admin") {
    const parsed = evidenceReviewSchema.parse(input);
    const evidence = await this.getEvidence(evidenceId);
    const updated = await this.repo.updateEvidenceStatus(evidenceId, parsed.status);
    await this.repo.createAuditLog({
      actor: parsed.reviewer ?? actor,
      action: `evidence.${parsed.status}`,
      entityType: "evidence_object",
      entityId: evidenceId,
      beforeState: evidence,
      afterState: {
        ...updated,
        notes: parsed.notes,
      },
    });
    return updated;
  }
}
