import { launchReadinessCheckSchema } from "@dropin/schemas";
import {
  buildCheck,
  getReadinessInputs,
  hasCoreTreasuryAccounts,
  statusDecision,
  type ReadinessReport,
  type StatusDependencies,
  type StatusService,
} from "./status-service.js";

export class ReadinessService {
  constructor(
    private readonly statusService: StatusService,
    private readonly deps: StatusDependencies,
  ) {}

  async getReadiness(campaignId = "campaign_v1_ggw_testnet"): Promise<ReadinessReport> {
    const [system, inputs] = await Promise.all([
      this.statusService.getSystemStatus(),
      getReadinessInputs(this.deps, campaignId),
    ]);
    const checks = [
      buildCheck(
        "campaign_exists",
        "Campaign exists",
        inputs.campaign ? "pass" : "fail",
        inputs.campaign ? `${inputs.campaign.id} found` : `${campaignId} missing`,
      ),
      buildCheck(
        "campaign_live",
        "Campaign status scheduled/live",
        inputs.campaign && ["scheduled", "active"].includes(inputs.campaign.status) ? "pass" : "fail",
        inputs.campaign ? `status=${inputs.campaign.status}` : "campaign missing",
      ),
      buildCheck(
        "linked_round",
        "Linked round exists",
        inputs.linkedRound ? "pass" : "fail",
        inputs.linkedRound ? inputs.linkedRound.id : "round missing",
      ),
      buildCheck(
        "linked_project",
        "Linked project exists",
        inputs.linkedProject ? "pass" : "fail",
        inputs.linkedProject ? inputs.linkedProject.id : "project missing",
      ),
      buildCheck(
        "treasury_accounts",
        "Treasury accounts exist",
        hasCoreTreasuryAccounts(inputs.treasuryAccounts) ? "pass" : "fail",
        `${inputs.treasuryAccounts.length} treasury accounts`,
      ),
      buildCheck("payment_mode", "Payment mode configured", system.paymentMode ? "pass" : "fail", system.paymentMode),
      buildCheck(
        "ton_testnet",
        "TON testnet represented",
        system.tonTestnet.enabled ? "pass" : "warn",
        system.tonTestnet.enabled ? "TON testnet enabled" : "TON testnet disabled for this launch run",
      ),
      buildCheck(
        "pending_payments",
        "Pending payment intents",
        system.counts.pendingPaymentIntents === 0 ? "pass" : "warn",
        `${system.counts.pendingPaymentIntents} pending`,
      ),
      buildCheck(
        "stale_payments",
        "Stale payment intents",
        system.counts.stalePaymentIntents === 0 ? "pass" : "warn",
        `${system.counts.stalePaymentIntents} stale`,
      ),
      buildCheck(
        "reconciliation",
        "Reconciliation critical mismatches",
        system.counts.reconciliationCriticalMismatches === 0 ? "pass" : "fail",
        `${system.counts.reconciliationCriticalMismatches} critical mismatches`,
      ),
      buildCheck(
        "risk_events",
        "Open risk events",
        system.counts.openRiskEvents === 0 ? "pass" : "warn",
        `${system.counts.openRiskEvents} open`,
      ),
      buildCheck(
        "challenges",
        "Open challenge cases",
        system.counts.criticalHighChallenges === 0 ? (system.counts.openChallenges === 0 ? "pass" : "warn") : "fail",
        `${system.counts.openChallenges} open, ${system.counts.criticalHighChallenges} critical/high`,
      ),
      buildCheck(
        "anchor_config",
        "Anchor config status",
        system.anchor.configured ? "pass" : "warn",
        system.anchor.configured ? "contracts/solana/Anchor.toml found" : "Anchor config missing",
      ),
      buildCheck("repository_mode", "Repository mode", system.repositoryMode ? "pass" : "fail", system.repositoryMode),
      buildCheck(
        "seed_demo",
        "Seed/demo data present",
        inputs.campaign && inputs.linkedRound && inputs.linkedProject ? "pass" : "fail",
        "campaign + round + project",
      ),
    ];
    const decision = statusDecision(checks);
    return {
      ready: decision !== "fail",
      decision,
      campaignId,
      generatedAt: system.generatedAt,
      checks,
      system,
    };
  }

  async runLaunchCheck(input: unknown) {
    const parsed = launchReadinessCheckSchema.parse(input);
    const report = await this.getReadiness(parsed.campaignId);
    const [launchCheck, snapshot] = await Promise.all([
      this.statusService.createLaunchCheck({
        actor: parsed.actor,
        campaignId: parsed.campaignId,
        decision: report.decision,
        report,
      }),
      this.statusService.createSnapshot(report.system, report.decision),
    ]);
    return { report, launchCheck, snapshot };
  }
}
