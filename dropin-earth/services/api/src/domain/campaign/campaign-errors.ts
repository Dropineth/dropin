export class CampaignNotFoundError extends Error {
  constructor(campaignId: string) {
    super(`Campaign not found: ${campaignId}`);
  }
}

export class CampaignStateError extends Error {
  constructor(message: string) {
    super(message);
  }
}
