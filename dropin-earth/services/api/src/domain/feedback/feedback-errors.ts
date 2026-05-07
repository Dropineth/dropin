export class FeedbackNotFoundError extends Error {
  constructor(feedbackId: string) {
    super(`Feedback item not found: ${feedbackId}`);
    this.name = "FeedbackNotFoundError";
  }
}
