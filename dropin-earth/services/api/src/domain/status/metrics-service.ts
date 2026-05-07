import type { StatusService } from "./status-service.js";

export class MetricsService {
  constructor(private readonly statusService: StatusService) {}

  async textMetrics() {
    const status = await this.statusService.getSystemStatus();
    const metrics = {
      dropin_payment_intents_pending: status.counts.pendingPaymentIntents,
      dropin_challenges_open: status.counts.openChallenges,
      dropin_risk_events_open: status.counts.openRiskEvents,
      dropin_campaigns_live: status.counts.liveCampaigns,
      dropin_feedback_open: status.counts.openFeedback,
      dropin_lottery_rounds_open: status.counts.lotteryRoundsOpen,
    };
    return Object.entries(metrics)
      .map(([name, value]) => `# TYPE ${name} gauge\n${name} ${value}`)
      .join("\n");
  }
}
