import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  AuditLog,
  Campaign,
  ChallengeCase,
  FeedbackItem,
  LaunchCheck,
  PaymentIntent,
  PaymentReconciliationReport,
  SystemStatusSnapshot,
  TreasuryAccount,
} from "@dropin/schemas";
import type { CampaignRepository } from "../campaign/campaign-repository.js";
import type { FeedbackRepository } from "../feedback/feedback-repository.js";
import type { FundRepository } from "../fund/fund-repository.js";
import type { ImpactRepository } from "../impact/impact-repository.js";
import type { AuditInput, LotteryRepository } from "../lottery/lottery-repository.js";
import type { PaymentRepository } from "../payment/payment-repository.js";
import type { RiskRepository } from "../risk/risk-repository.js";

export type LaunchGateStatus = "pass" | "warn" | "fail";

export type StatusDependencies = {
  campaignRepo: CampaignRepository;
  lotteryRepo: LotteryRepository;
  impactRepo: ImpactRepository;
  fundRepo: FundRepository;
  paymentRepo: PaymentRepository;
  riskRepo: RiskRepository;
  feedbackRepo: FeedbackRepository;
  repositoryMode: string;
  paymentMode: string;
};

export type ReadinessCheck = {
  id: string;
  label: string;
  status: LaunchGateStatus;
  detail: string;
};

export type SystemStatus = {
  generatedAt: string;
  repositoryMode: string;
  paymentMode: string;
  tonTestnet: {
    enabled: boolean;
    configured: boolean;
  };
  anchor: {
    configured: boolean;
    programId?: string | undefined;
  };
  counts: {
    campaigns: number;
    liveCampaigns: number;
    lotteryRoundsOpen: number;
    pendingPaymentIntents: number;
    stalePaymentIntents: number;
    reconciliationCriticalMismatches: number;
    openRiskEvents: number;
    openChallenges: number;
    criticalHighChallenges: number;
    openFeedback: number;
    treasuryAccounts: number;
  };
};

export type ReadinessReport = {
  ready: boolean;
  decision: LaunchGateStatus;
  campaignId: string;
  generatedAt: string;
  checks: ReadinessCheck[];
  system: SystemStatus;
};

export interface StatusRepository {
  makeId(prefix: string): string;
  now(): string;
  createLaunchCheck(input: Omit<LaunchCheck, "id" | "createdAt">): Promise<LaunchCheck>;
  listLaunchChecks(): Promise<LaunchCheck[]>;
  createSystemStatusSnapshot(input: Omit<SystemStatusSnapshot, "id" | "createdAt">): Promise<SystemStatusSnapshot>;
  createAuditLog(input: AuditInput): Promise<AuditLog>;
  listAuditLogs(): Promise<AuditLog[]>;
}

export function makeId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function hasAnchorConfig() {
  return [
    "contracts/solana/Anchor.toml",
    "../contracts/solana/Anchor.toml",
    "../../contracts/solana/Anchor.toml",
    "../../../contracts/solana/Anchor.toml",
  ].some((candidate) => existsSync(candidate));
}

export class InMemoryStatusRepository implements StatusRepository {
  readonly launchChecks = new Map<string, LaunchCheck>();
  readonly snapshots = new Map<string, SystemStatusSnapshot>();
  readonly auditLogs: AuditLog[] = [];

  makeId(prefix: string) {
    return makeId(prefix);
  }

  now() {
    return nowIso();
  }

  async createLaunchCheck(input: Omit<LaunchCheck, "id" | "createdAt">) {
    const check: LaunchCheck = { ...input, id: this.makeId("launch_check"), createdAt: this.now() };
    this.launchChecks.set(check.id, check);
    return check;
  }

  async listLaunchChecks() {
    return [...this.launchChecks.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async createSystemStatusSnapshot(input: Omit<SystemStatusSnapshot, "id" | "createdAt">) {
    const snapshot: SystemStatusSnapshot = { ...input, id: this.makeId("system_status"), createdAt: this.now() };
    this.snapshots.set(snapshot.id, snapshot);
    return snapshot;
  }

  async createAuditLog(input: AuditInput) {
    const auditLog: AuditLog = {
      id: this.makeId("audit"),
      actor: input.actor,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeState: input.beforeState,
      afterState: input.afterState,
      requestId: input.requestId,
      createdAt: this.now(),
    };
    this.auditLogs.push(auditLog);
    return auditLog;
  }

  async listAuditLogs() {
    return [...this.auditLogs].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
}

export class PrismaStatusRepository implements StatusRepository {
  constructor(readonly prisma: PrismaClient) {}

  makeId(prefix: string) {
    return makeId(prefix);
  }

  now() {
    return nowIso();
  }

  async createLaunchCheck(input: Omit<LaunchCheck, "id" | "createdAt">) {
    const created = await this.prisma.launchCheck.create({
      data: {
        id: this.makeId("launch_check"),
        actor: input.actor,
        campaignId: input.campaignId,
        decision: input.decision,
        summary: jsonValue(input.summary),
      },
    });
    return {
      id: created.id,
      actor: created.actor,
      campaignId: created.campaignId,
      decision: created.decision as LaunchCheck["decision"],
      summary: created.summary,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async listLaunchChecks() {
    const checks = await this.prisma.launchCheck.findMany({ orderBy: { createdAt: "desc" } });
    return checks.map((check) => ({
      id: check.id,
      actor: check.actor,
      campaignId: check.campaignId,
      decision: check.decision as LaunchCheck["decision"],
      summary: check.summary,
      createdAt: check.createdAt.toISOString(),
    }));
  }

  async createSystemStatusSnapshot(input: Omit<SystemStatusSnapshot, "id" | "createdAt">) {
    const created = await this.prisma.systemStatusSnapshot.create({
      data: {
        id: this.makeId("system_status"),
        status: input.status,
        repositoryMode: input.repositoryMode,
        paymentMode: input.paymentMode,
        campaignCount: input.campaignCount,
        liveCampaignCount: input.liveCampaignCount,
        openRiskEventCount: input.openRiskEventCount,
        openChallengeCount: input.openChallengeCount,
        pendingPaymentIntentCount: input.pendingPaymentIntentCount,
        stalePaymentIntentCount: input.stalePaymentIntentCount,
        metrics: jsonValue(input.metrics),
      },
    });
    return {
      id: created.id,
      status: created.status as SystemStatusSnapshot["status"],
      repositoryMode: created.repositoryMode,
      paymentMode: created.paymentMode,
      campaignCount: created.campaignCount,
      liveCampaignCount: created.liveCampaignCount,
      openRiskEventCount: created.openRiskEventCount,
      openChallengeCount: created.openChallengeCount,
      pendingPaymentIntentCount: created.pendingPaymentIntentCount,
      stalePaymentIntentCount: created.stalePaymentIntentCount,
      metrics: created.metrics,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async createAuditLog(input: AuditInput) {
    const created = await this.prisma.auditLog.create({
      data: {
        id: this.makeId("audit"),
        actor: input.actor,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeState: input.beforeState === undefined ? Prisma.JsonNull : jsonValue(input.beforeState),
        afterState: input.afterState === undefined ? Prisma.JsonNull : jsonValue(input.afterState),
        requestId: input.requestId ?? null,
      },
    });
    return {
      id: created.id,
      actor: created.actor,
      action: created.action,
      entityType: created.entityType,
      entityId: created.entityId,
      beforeState: created.beforeState,
      afterState: created.afterState,
      requestId: created.requestId ?? undefined,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async listAuditLogs() {
    const logs = await this.prisma.auditLog.findMany({ orderBy: { createdAt: "desc" } });
    return logs.map((log) => ({
      id: log.id,
      actor: log.actor,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      beforeState: log.beforeState,
      afterState: log.afterState,
      requestId: log.requestId ?? undefined,
      createdAt: log.createdAt.toISOString(),
    }));
  }
}

export class StatusService {
  constructor(
    private readonly repo: StatusRepository,
    private readonly deps: StatusDependencies,
  ) {}

  async getSystemStatus(): Promise<SystemStatus> {
    const [campaigns, rounds, payments, reconciliationReports, riskEvents, challenges, feedback, treasuryAccounts] = await Promise.all([
      this.deps.campaignRepo.listCampaigns(),
      this.deps.lotteryRepo.listRounds(),
      this.deps.paymentRepo.listPaymentIntents(),
      this.deps.paymentRepo.listReconciliationReports(),
      this.deps.riskRepo.listRiskEvents(),
      this.deps.riskRepo.listChallenges(),
      this.deps.feedbackRepo.listFeedback(),
      this.deps.fundRepo.listTreasuryAccounts(),
    ]);
    const pendingPayments = payments.filter((intent) => ["awaiting_payment", "submitted", "confirming"].includes(intent.status));
    const stalePayments = pendingPayments.filter((intent) => Date.parse(intent.expiresAt) < Date.now());
    const openChallenges = challenges.filter((challenge) => isOpenChallenge(challenge));
    return {
      generatedAt: this.repo.now(),
      repositoryMode: this.deps.repositoryMode,
      paymentMode: this.deps.paymentMode,
      tonTestnet: {
        enabled: process.env.DROPIN_TON_TESTNET_ENABLED === "true",
        configured: Boolean(process.env.DROPIN_TON_TESTNET_TREASURY_ADDRESS),
      },
      anchor: {
        configured: hasAnchorConfig(),
        programId: process.env.DROPIN_SOLANA_PROGRAM_ID,
      },
      counts: {
        campaigns: campaigns.length,
        liveCampaigns: campaigns.filter((campaign) => campaign.status === "active").length,
        lotteryRoundsOpen: rounds.filter((round) => round.status === "open").length,
        pendingPaymentIntents: pendingPayments.length,
        stalePaymentIntents: stalePayments.length,
        reconciliationCriticalMismatches: countCriticalPaymentAnomalies(reconciliationReports),
        openRiskEvents: riskEvents.filter((event) => event.status === "open").length,
        openChallenges: openChallenges.length,
        criticalHighChallenges: openChallenges.filter((challenge) => ["critical", "high"].includes(challenge.severity)).length,
        openFeedback: feedback.filter((item) => item.status === "open").length,
        treasuryAccounts: treasuryAccounts.length,
      },
    };
  }

  async createSnapshot(status: SystemStatus, decision: LaunchGateStatus) {
    return this.repo.createSystemStatusSnapshot({
      status: decision,
      repositoryMode: status.repositoryMode,
      paymentMode: status.paymentMode,
      campaignCount: status.counts.campaigns,
      liveCampaignCount: status.counts.liveCampaigns,
      openRiskEventCount: status.counts.openRiskEvents,
      openChallengeCount: status.counts.openChallenges,
      pendingPaymentIntentCount: status.counts.pendingPaymentIntents,
      stalePaymentIntentCount: status.counts.stalePaymentIntents,
      metrics: status.counts,
    });
  }

  async createLaunchCheck(input: { actor: string; campaignId: string; report: unknown; decision: LaunchGateStatus }) {
    const launchCheck = await this.repo.createLaunchCheck({
      actor: input.actor,
      campaignId: input.campaignId,
      decision: input.decision,
      summary: input.report,
    });
    await this.repo.createAuditLog({
      actor: input.actor,
      action: "launch.check",
      entityType: "launch_check",
      entityId: launchCheck.id,
      afterState: launchCheck,
    });
    return launchCheck;
  }

  listLaunchChecks() {
    return this.repo.listLaunchChecks();
  }

  listAuditLogs() {
    return this.repo.listAuditLogs();
  }
}

export async function getReadinessInputs(deps: StatusDependencies, campaignId: string) {
  const [campaigns, treasuryAccounts] = await Promise.all([
    deps.campaignRepo.listCampaigns(),
    deps.fundRepo.listTreasuryAccounts(),
  ]);
  const campaign = campaigns.find((item) => item.id === campaignId || item.slug === campaignId);
  const linkedRound = campaign?.roundId ? await deps.lotteryRepo.getRound(campaign.roundId) : undefined;
  const linkedProject = campaign?.projectId ? await deps.impactRepo.getProject(campaign.projectId) : undefined;
  return { campaigns, campaign, linkedRound, linkedProject, treasuryAccounts };
}

export function buildCheck(id: string, label: string, status: LaunchGateStatus, detail: string): ReadinessCheck {
  return { id, label, status, detail };
}

export function statusDecision(checks: ReadinessCheck[]): LaunchGateStatus {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warn")) return "warn";
  return "pass";
}

export function hasCoreTreasuryAccounts(accounts: TreasuryAccount[]) {
  const required = [
    "prize_pool",
    "tree_planting_fund",
    "operations",
    "insurance_challenge_pool",
    "referral_growth",
    "protocol_reserve",
  ] as const;
  const activeTypes = new Set(accounts.filter((account) => account.status === "active").map((account) => account.type));
  return required.every((type) => activeTypes.has(type));
}

export function isOpenChallenge(challenge: ChallengeCase) {
  return !["resolved", "rejected", "cancelled"].includes(challenge.status);
}

export function countCriticalPaymentAnomalies(reports: PaymentReconciliationReport[]) {
  const critical = ["duplicate_tx_hash", "wrong_recipient", "amount_mismatch", "currency_mismatch", "missing_memo", "wrong_network"];
  return reports.reduce((count, report) => {
    const anomalies = report.anomalies as Array<Record<string, unknown>>;
    return count + anomalies.filter((item) => critical.includes(String(item.type ?? item.reason ?? ""))).length;
  }, 0);
}

export function summarizeFeedback(items: FeedbackItem[]) {
  return {
    open: items.filter((item) => item.status === "open").length,
    high: items.filter((item) => item.status === "open" && item.severity === "high").length,
  };
}

export function summarizePayments(intents: PaymentIntent[]) {
  const pending = intents.filter((intent) => ["awaiting_payment", "submitted", "confirming"].includes(intent.status));
  return {
    pending: pending.length,
    stale: pending.filter((intent) => Date.parse(intent.expiresAt) < Date.now()).length,
  };
}

export function summarizeCampaigns(campaigns: Campaign[]) {
  return {
    total: campaigns.length,
    live: campaigns.filter((campaign) => campaign.status === "active").length,
  };
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
