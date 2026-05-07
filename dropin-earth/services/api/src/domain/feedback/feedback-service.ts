import { createFeedbackSchema, resolveFeedbackSchema } from "@dropin/schemas";
import { FeedbackNotFoundError } from "./feedback-errors.js";
import type { FeedbackRepository } from "./feedback-repository.js";

export class FeedbackService {
  constructor(private readonly repo: FeedbackRepository) {}

  async createFeedback(input: unknown) {
    const parsed = createFeedbackSchema.parse(input);
    const feedback = await this.repo.createFeedback(parsed);
    await this.repo.createAuditLog({
      actor: parsed.userId ?? parsed.source,
      action: "feedback.create",
      entityType: "feedback_item",
      entityId: feedback.id,
      afterState: feedback,
    });
    return feedback;
  }

  listFeedback() {
    return this.repo.listFeedback();
  }

  async resolveFeedback(feedbackId: string, input: unknown) {
    const before = await this.mustGetFeedback(feedbackId);
    const parsed = resolveFeedbackSchema.parse(input);
    const resolved = await this.repo.updateFeedback({
      ...before,
      status: parsed.status,
      resolution: parsed.resolution,
      resolvedBy: parsed.actor,
      resolvedAt: this.repo.now(),
    });
    await this.repo.createAuditLog({
      actor: parsed.actor,
      action: "feedback.resolve",
      entityType: "feedback_item",
      entityId: feedbackId,
      beforeState: before,
      afterState: resolved,
    });
    return resolved;
  }

  private async mustGetFeedback(feedbackId: string) {
    const feedback = await this.repo.getFeedback(feedbackId);
    if (!feedback) throw new FeedbackNotFoundError(feedbackId);
    return feedback;
  }
}
