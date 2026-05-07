import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { hashJson, merkleRoot } from "@dropin/crypto";
import type {
  AuditLog,
  Currency,
  FundAllocation,
  ProjectMilestoneRelease,
  SettlementCertificate,
  TreasuryAccount,
  TreasuryTransaction,
} from "@dropin/schemas";
import type { AuditInput } from "../lottery/lottery-repository.js";

export type CreateTreasuryAccountInput = Omit<TreasuryAccount, "createdAt" | "updatedAt">;
export type CreateTreasuryTransactionInput = Omit<TreasuryTransaction, "createdAt" | "postedAt"> & {
  postedAt?: string | undefined;
};
export type CreateFundAllocationInput = Omit<FundAllocation, "id" | "createdAt" | "updatedAt"> & {
  id?: string | undefined;
};
export type CreateMilestoneReleaseInput = Omit<ProjectMilestoneRelease, "id" | "createdAt" | "updatedAt">;
export type CreateSettlementCertificateInput = Omit<SettlementCertificate, "id" | "createdAt" | "updatedAt">;

export interface FundRepository {
  makeId(prefix: string): string;
  now(): string;
  ensureCoreAccounts(currency: Currency): Promise<TreasuryAccount[]>;
  ensureProjectEscrowAccount(projectId: string, currency: Currency): Promise<TreasuryAccount>;
  getTreasuryAccount(accountId: string): Promise<TreasuryAccount | undefined>;
  listTreasuryAccounts(): Promise<TreasuryAccount[]>;
  createTreasuryTransaction(input: CreateTreasuryTransactionInput): Promise<TreasuryTransaction>;
  getTreasuryTransaction(transactionId: string): Promise<TreasuryTransaction | undefined>;
  listTreasuryTransactions(): Promise<TreasuryTransaction[]>;
  updateTreasuryTransactionStatus(
    transactionId: string,
    status: TreasuryTransaction["status"],
  ): Promise<TreasuryTransaction>;
  createFundAllocation(input: CreateFundAllocationInput): Promise<FundAllocation>;
  getFundAllocation(allocationId: string): Promise<FundAllocation | undefined>;
  getFundAllocationBySource(
    sourceType: FundAllocation["sourceType"],
    sourceId: string,
    allocationType: FundAllocation["allocationType"],
  ): Promise<FundAllocation | undefined>;
  listFundAllocations(): Promise<FundAllocation[]>;
  updateFundAllocation(allocation: FundAllocation): Promise<FundAllocation>;
  createMilestoneRelease(input: CreateMilestoneReleaseInput): Promise<ProjectMilestoneRelease>;
  getMilestoneRelease(releaseId: string): Promise<ProjectMilestoneRelease | undefined>;
  getLatestMilestoneRelease(projectId: string, milestoneId: string): Promise<ProjectMilestoneRelease | undefined>;
  listMilestoneReleases(projectId?: string): Promise<ProjectMilestoneRelease[]>;
  updateMilestoneReleaseStatus(
    releaseId: string,
    status: ProjectMilestoneRelease["status"],
  ): Promise<ProjectMilestoneRelease>;
  createSettlementCertificate(input: CreateSettlementCertificateInput): Promise<SettlementCertificate>;
  getSettlementCertificate(settlementId: string): Promise<SettlementCertificate | undefined>;
  getLatestSettlement(projectId: string, milestoneId: string): Promise<SettlementCertificate | undefined>;
  listSettlementCertificates(projectId?: string): Promise<SettlementCertificate[]>;
  updateSettlementCertificateStatus(
    settlementId: string,
    status: SettlementCertificate["status"],
  ): Promise<SettlementCertificate>;
  createAuditLog(input: AuditInput): Promise<AuditLog>;
  listAuditLogs(): Promise<AuditLog[]>;
}

export function nowIso() {
  return new Date().toISOString();
}

export function makeId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

export function treasuryAccountId(type: TreasuryAccount["type"], currency: Currency, suffix?: string) {
  return suffix ? `treasury_${type}_${currency.toLowerCase()}_${suffix}` : `treasury_${type}_${currency.toLowerCase()}`;
}

export class InMemoryFundRepository implements FundRepository {
  readonly accounts = new Map<string, TreasuryAccount>();
  readonly transactions = new Map<string, TreasuryTransaction>();
  readonly allocations = new Map<string, FundAllocation>();
  readonly releases = new Map<string, ProjectMilestoneRelease>();
  readonly settlements = new Map<string, SettlementCertificate>();
  readonly auditLogs: AuditLog[] = [];

  constructor(seed = true) {
    if (seed) {
      void this.ensureCoreAccounts("USDC");
      this.seedDemo();
    }
  }

  makeId(prefix: string) {
    return makeId(prefix);
  }

  now() {
    return nowIso();
  }

  async ensureCoreAccounts(currency: Currency) {
    const accountTypes: TreasuryAccount["type"][] = [
      "payment_clearing",
      "prize_pool",
      "tree_planting_fund",
      "operations",
      "insurance_challenge_pool",
      "referral_growth",
      "protocol_reserve",
      "round_escrow",
    ];
    return Promise.all(
      accountTypes.map((type) => this.ensureAccount({ type, currency, name: titleize(type), suffix: type === "round_escrow" ? "global" : undefined })),
    );
  }

  async ensureProjectEscrowAccount(projectId: string, currency: Currency) {
    return this.ensureAccount({
      type: "project_escrow",
      currency,
      name: `Project escrow ${projectId}`,
      suffix: projectId,
    });
  }

  async getTreasuryAccount(accountId: string) {
    return this.accounts.get(accountId);
  }

  async listTreasuryAccounts() {
    return [...this.accounts.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  async createTreasuryTransaction(input: CreateTreasuryTransactionInput) {
    const createdAt = this.now();
    const transaction: TreasuryTransaction = {
      ...input,
      createdAt,
      ...(input.status === "posted" ? { postedAt: input.postedAt ?? createdAt } : {}),
    };
    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  async getTreasuryTransaction(transactionId: string) {
    return this.transactions.get(transactionId);
  }

  async listTreasuryTransactions() {
    return [...this.transactions.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async updateTreasuryTransactionStatus(transactionId: string, status: TreasuryTransaction["status"]) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Treasury transaction not found: ${transactionId}`);
    }
    const updated: TreasuryTransaction = { ...transaction, status };
    this.transactions.set(transactionId, updated);
    return updated;
  }

  async createFundAllocation(input: CreateFundAllocationInput) {
    const now = this.now();
    const allocation: FundAllocation = {
      ...input,
      id: input.id ?? this.makeId("fund_allocation"),
      createdAt: now,
      updatedAt: now,
    };
    this.allocations.set(allocation.id, allocation);
    return allocation;
  }

  async getFundAllocation(allocationId: string) {
    return this.allocations.get(allocationId);
  }

  async getFundAllocationBySource(
    sourceType: FundAllocation["sourceType"],
    sourceId: string,
    allocationType: FundAllocation["allocationType"],
  ) {
    return [...this.allocations.values()].find(
      (allocation) =>
        allocation.sourceType === sourceType &&
        allocation.sourceId === sourceId &&
        allocation.allocationType === allocationType,
    );
  }

  async listFundAllocations() {
    return [...this.allocations.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async updateFundAllocation(allocation: FundAllocation) {
    const updated: FundAllocation = { ...allocation, updatedAt: this.now() };
    this.allocations.set(allocation.id, updated);
    return updated;
  }

  async createMilestoneRelease(input: CreateMilestoneReleaseInput) {
    const now = this.now();
    const release: ProjectMilestoneRelease = {
      ...input,
      id: this.makeId("milestone_release"),
      createdAt: now,
      updatedAt: now,
    };
    this.releases.set(release.id, release);
    return release;
  }

  async getMilestoneRelease(releaseId: string) {
    return this.releases.get(releaseId);
  }

  async getLatestMilestoneRelease(projectId: string, milestoneId: string) {
    return [...this.releases.values()]
      .filter((release) => release.projectId === projectId && release.milestoneId === milestoneId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }

  async listMilestoneReleases(projectId?: string) {
    return [...this.releases.values()]
      .filter((release) => !projectId || release.projectId === projectId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async updateMilestoneReleaseStatus(releaseId: string, status: ProjectMilestoneRelease["status"]) {
    const release = this.releases.get(releaseId);
    if (!release) {
      throw new Error(`Project milestone release not found: ${releaseId}`);
    }
    const updated: ProjectMilestoneRelease = { ...release, status, updatedAt: this.now() };
    this.releases.set(releaseId, updated);
    return updated;
  }

  async createSettlementCertificate(input: CreateSettlementCertificateInput) {
    const now = this.now();
    const settlement: SettlementCertificate = {
      ...input,
      id: this.makeId("settlement"),
      createdAt: now,
      updatedAt: now,
    };
    this.settlements.set(settlement.id, settlement);
    return settlement;
  }

  async getSettlementCertificate(settlementId: string) {
    return this.settlements.get(settlementId);
  }

  async getLatestSettlement(projectId: string, milestoneId: string) {
    return [...this.settlements.values()]
      .filter((settlement) => settlement.projectId === projectId && settlement.milestoneId === milestoneId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }

  async listSettlementCertificates(projectId?: string) {
    return [...this.settlements.values()]
      .filter((settlement) => !projectId || settlement.projectId === projectId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async updateSettlementCertificateStatus(settlementId: string, status: SettlementCertificate["status"]) {
    const settlement = this.settlements.get(settlementId);
    if (!settlement) {
      throw new Error(`Settlement certificate not found: ${settlementId}`);
    }
    const updated: SettlementCertificate = { ...settlement, status, updatedAt: this.now() };
    this.settlements.set(settlementId, updated);
    return updated;
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

  private async ensureAccount(input: {
    type: TreasuryAccount["type"];
    currency: Currency;
    name: string;
    suffix?: string | undefined;
  }) {
    const id = treasuryAccountId(input.type, input.currency, input.suffix);
    const existing = this.accounts.get(id);
    if (existing) {
      return existing;
    }
    const now = this.now();
    const account: TreasuryAccount = {
      id,
      type: input.type,
      name: input.name,
      currency: input.currency,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    this.accounts.set(account.id, account);
    return account;
  }

  private seedDemo() {
    const now = this.now();
    const projectEscrowAccount: TreasuryAccount = {
      id: treasuryAccountId("project_escrow", "USDC", "project_v1_ggw_demo"),
      type: "project_escrow",
      name: "Project escrow project_v1_ggw_demo",
      currency: "USDC",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    this.accounts.set(projectEscrowAccount.id, projectEscrowAccount);
    const transaction: TreasuryTransaction = {
      id: "treasury_tx_v1_ggw_tree_fund_demo",
      type: "lottery_allocation",
      debitAccountId: treasuryAccountId("round_escrow", "USDC", "global"),
      creditAccountId: treasuryAccountId("tree_planting_fund", "USDC"),
      amount: "0",
      currency: "USDC",
      sourceType: "lottery_round",
      sourceId: "round_v1_ggw_demo",
      status: "posted",
      memo: "Seeded Tree Fund allocation placeholder",
      createdAt: now,
      postedAt: now,
    };
    this.transactions.set(transaction.id, transaction);
    const allocation: FundAllocation = {
      id: "fund_allocation_v1_ggw_tree_fund_demo",
      sourceType: "lottery_round",
      sourceId: "round_v1_ggw_demo",
      allocationType: "tree_fund",
      projectId: "project_v1_ggw_demo",
      amount: "0",
      currency: "USDC",
      status: "approved",
      ledgerTransactionId: transaction.id,
      createdAt: now,
      updatedAt: now,
    };
    this.allocations.set(allocation.id, allocation);

    const releaseTransaction: TreasuryTransaction = {
      id: "treasury_tx_v1_ggw_milestone_release_demo",
      type: "milestone_release",
      debitAccountId: treasuryAccountId("tree_planting_fund", "USDC"),
      creditAccountId: projectEscrowAccount.id,
      amount: "2500",
      currency: "USDC",
      sourceType: "project_milestone",
      sourceId: "milestone_v1_ggw_demo_1",
      status: "posted",
      memo: "Seeded milestone release placeholder",
      createdAt: now,
      postedAt: now,
    };
    this.transactions.set(releaseTransaction.id, releaseTransaction);

    const release: ProjectMilestoneRelease = {
      id: "milestone_release_v1_ggw_demo",
      projectId: "project_v1_ggw_demo",
      milestoneId: "milestone_v1_ggw_demo_1",
      allocationId: allocation.id,
      amount: "2500",
      currency: "USDC",
      status: "settled",
      ledgerTransactionId: releaseTransaction.id,
      createdAt: now,
      updatedAt: now,
    };
    this.releases.set(release.id, release);

    const evidenceRoot = merkleRoot(["a".repeat(64), "b".repeat(64)].sort());
    const settlementHash = hashJson({
      kind: "dropin-settlement-certificate-v1",
      projectId: "project_v1_ggw_demo",
      milestoneId: "milestone_v1_ggw_demo_1",
      evidenceRoot,
      amount: "2500",
      currency: "USDC",
      certificateId: "cert_v1_ggw_demo",
      finalSettlement: true,
    });
    const settlement: SettlementCertificate = {
      id: "settlement_v1_ggw_demo",
      projectId: "project_v1_ggw_demo",
      milestoneId: "milestone_v1_ggw_demo_1",
      releaseId: release.id,
      evidenceRoot,
      amount: "2500",
      currency: "USDC",
      certificateId: "cert_v1_ggw_demo",
      settlementHash,
      finalSettlement: true,
      status: "issued",
      createdAt: now,
      updatedAt: now,
    };
    this.settlements.set(settlement.id, settlement);
  }
}

export class PrismaFundRepository implements FundRepository {
  constructor(readonly prisma: PrismaClient) {}

  makeId(prefix: string) {
    return makeId(prefix);
  }

  now() {
    return nowIso();
  }

  async ensureCoreAccounts(currency: Currency) {
    const accountTypes: TreasuryAccount["type"][] = [
      "prize_pool",
      "tree_planting_fund",
      "operations",
      "insurance_challenge_pool",
      "referral_growth",
      "protocol_reserve",
      "round_escrow",
    ];
    const accounts = [];
    for (const type of accountTypes) {
      accounts.push(
        await this.upsertAccount({
          id: treasuryAccountId(type, currency, type === "round_escrow" ? "global" : undefined),
          type,
          name: titleize(type),
          currency,
          status: "active",
        }),
      );
    }
    return accounts;
  }

  async ensureProjectEscrowAccount(projectId: string, currency: Currency) {
    return this.upsertAccount({
      id: treasuryAccountId("project_escrow", currency, projectId),
      type: "project_escrow",
      name: `Project escrow ${projectId}`,
      currency,
      status: "active",
    });
  }

  async getTreasuryAccount(accountId: string) {
    const account = await this.prisma.treasuryAccount.findUnique({ where: { id: accountId } });
    return account ? toTreasuryAccount(account) : undefined;
  }

  async listTreasuryAccounts() {
    const accounts = await this.prisma.treasuryAccount.findMany({ orderBy: { id: "asc" } });
    return accounts.map(toTreasuryAccount);
  }

  async createTreasuryTransaction(input: CreateTreasuryTransactionInput) {
    const created = await this.prisma.treasuryTransaction.create({
      data: {
        id: input.id,
        type: input.type,
        debitAccountId: input.debitAccountId,
        creditAccountId: input.creditAccountId,
        amount: input.amount,
        currency: input.currency,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        status: input.status,
        reversalOfId: input.reversalOfId ?? null,
        memo: input.memo ?? null,
        postedAt: input.postedAt ? new Date(input.postedAt) : input.status === "posted" ? new Date() : null,
      },
    });
    return toTreasuryTransaction(created);
  }

  async getTreasuryTransaction(transactionId: string) {
    const transaction = await this.prisma.treasuryTransaction.findUnique({ where: { id: transactionId } });
    return transaction ? toTreasuryTransaction(transaction) : undefined;
  }

  async listTreasuryTransactions() {
    const transactions = await this.prisma.treasuryTransaction.findMany({ orderBy: { createdAt: "desc" } });
    return transactions.map(toTreasuryTransaction);
  }

  async updateTreasuryTransactionStatus(transactionId: string, status: TreasuryTransaction["status"]) {
    const updated = await this.prisma.treasuryTransaction.update({
      where: { id: transactionId },
      data: { status },
    });
    return toTreasuryTransaction(updated);
  }

  async createFundAllocation(input: CreateFundAllocationInput) {
    const created = await this.prisma.fundAllocation.create({
      data: {
        id: input.id ?? this.makeId("fund_allocation"),
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        allocationType: input.allocationType,
        projectId: input.projectId ?? null,
        amount: input.amount,
        currency: input.currency,
        status: input.status,
        ledgerTransactionId: input.ledgerTransactionId ?? null,
      },
    });
    return toFundAllocation(created);
  }

  async getFundAllocation(allocationId: string) {
    const allocation = await this.prisma.fundAllocation.findUnique({ where: { id: allocationId } });
    return allocation ? toFundAllocation(allocation) : undefined;
  }

  async getFundAllocationBySource(
    sourceType: FundAllocation["sourceType"],
    sourceId: string,
    allocationType: FundAllocation["allocationType"],
  ) {
    const allocation = await this.prisma.fundAllocation.findFirst({
      where: { sourceType, sourceId, allocationType },
    });
    return allocation ? toFundAllocation(allocation) : undefined;
  }

  async listFundAllocations() {
    const allocations = await this.prisma.fundAllocation.findMany({ orderBy: { createdAt: "desc" } });
    return allocations.map(toFundAllocation);
  }

  async updateFundAllocation(allocation: FundAllocation) {
    const updated = await this.prisma.fundAllocation.update({
      where: { id: allocation.id },
      data: {
        projectId: allocation.projectId ?? null,
        amount: allocation.amount,
        currency: allocation.currency,
        status: allocation.status,
        ledgerTransactionId: allocation.ledgerTransactionId ?? null,
      },
    });
    return toFundAllocation(updated);
  }

  async createMilestoneRelease(input: CreateMilestoneReleaseInput) {
    const created = await this.prisma.projectMilestoneRelease.create({
      data: {
        id: this.makeId("milestone_release"),
        projectId: input.projectId,
        milestoneId: input.milestoneId,
        allocationId: input.allocationId ?? null,
        amount: input.amount,
        currency: input.currency,
        status: input.status,
        ledgerTransactionId: input.ledgerTransactionId,
      },
    });
    return toMilestoneRelease(created);
  }

  async getMilestoneRelease(releaseId: string) {
    const release = await this.prisma.projectMilestoneRelease.findUnique({ where: { id: releaseId } });
    return release ? toMilestoneRelease(release) : undefined;
  }

  async getLatestMilestoneRelease(projectId: string, milestoneId: string) {
    const release = await this.prisma.projectMilestoneRelease.findFirst({
      where: { projectId, milestoneId },
      orderBy: { createdAt: "desc" },
    });
    return release ? toMilestoneRelease(release) : undefined;
  }

  async listMilestoneReleases(projectId?: string) {
    const releases = projectId
      ? await this.prisma.projectMilestoneRelease.findMany({
          where: { projectId },
          orderBy: { createdAt: "desc" },
        })
      : await this.prisma.projectMilestoneRelease.findMany({ orderBy: { createdAt: "desc" } });
    return releases.map(toMilestoneRelease);
  }

  async updateMilestoneReleaseStatus(releaseId: string, status: ProjectMilestoneRelease["status"]) {
    const updated = await this.prisma.projectMilestoneRelease.update({
      where: { id: releaseId },
      data: { status },
    });
    return toMilestoneRelease(updated);
  }

  async createSettlementCertificate(input: CreateSettlementCertificateInput) {
    const created = await this.prisma.settlementCertificate.create({
      data: {
        id: this.makeId("settlement"),
        projectId: input.projectId,
        milestoneId: input.milestoneId,
        releaseId: input.releaseId,
        evidenceRoot: input.evidenceRoot,
        amount: input.amount,
        currency: input.currency,
        certificateId: input.certificateId ?? null,
        settlementHash: input.settlementHash,
        finalSettlement: input.finalSettlement,
        status: input.status,
      },
    });
    return toSettlement(created);
  }

  async getSettlementCertificate(settlementId: string) {
    const settlement = await this.prisma.settlementCertificate.findUnique({ where: { id: settlementId } });
    return settlement ? toSettlement(settlement) : undefined;
  }

  async getLatestSettlement(projectId: string, milestoneId: string) {
    const settlement = await this.prisma.settlementCertificate.findFirst({
      where: { projectId, milestoneId },
      orderBy: { createdAt: "desc" },
    });
    return settlement ? toSettlement(settlement) : undefined;
  }

  async listSettlementCertificates(projectId?: string) {
    const settlements = projectId
      ? await this.prisma.settlementCertificate.findMany({
          where: { projectId },
          orderBy: { createdAt: "desc" },
        })
      : await this.prisma.settlementCertificate.findMany({ orderBy: { createdAt: "desc" } });
    return settlements.map(toSettlement);
  }

  async updateSettlementCertificateStatus(settlementId: string, status: SettlementCertificate["status"]) {
    const updated = await this.prisma.settlementCertificate.update({
      where: { id: settlementId },
      data: { status },
    });
    return toSettlement(updated);
  }

  async createAuditLog(input: AuditInput) {
    const created = await this.prisma.auditLog.create({
      data: {
        id: this.makeId("audit"),
        actor: input.actor,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeState: input.beforeState === undefined ? null : JSON.parse(JSON.stringify(input.beforeState)),
        afterState: input.afterState === undefined ? null : JSON.parse(JSON.stringify(input.afterState)),
        requestId: input.requestId ?? null,
      },
    });
    return toAuditLog(created);
  }

  async listAuditLogs() {
    const logs = await this.prisma.auditLog.findMany({ orderBy: { createdAt: "desc" } });
    return logs.map(toAuditLog);
  }

  private async upsertAccount(input: CreateTreasuryAccountInput) {
    const account = await this.prisma.treasuryAccount.upsert({
      where: { id: input.id },
      update: {
        type: input.type,
        name: input.name,
        currency: input.currency,
        status: input.status,
      },
      create: input,
    });
    return toTreasuryAccount(account);
  }
}

type PrismaTreasuryAccount = Awaited<ReturnType<PrismaClient["treasuryAccount"]["findFirst"]>>;
type PrismaTreasuryTransaction = Awaited<ReturnType<PrismaClient["treasuryTransaction"]["findFirst"]>>;
type PrismaFundAllocation = Awaited<ReturnType<PrismaClient["fundAllocation"]["findFirst"]>>;
type PrismaMilestoneRelease = Awaited<ReturnType<PrismaClient["projectMilestoneRelease"]["findFirst"]>>;
type PrismaSettlementCertificate = Awaited<ReturnType<PrismaClient["settlementCertificate"]["findFirst"]>>;
type PrismaAuditLog = Awaited<ReturnType<PrismaClient["auditLog"]["findFirst"]>>;

function titleize(value: string) {
  return value
    .split("_")
    .map((item) => `${item.slice(0, 1).toUpperCase()}${item.slice(1)}`)
    .join(" ");
}

function toTreasuryAccount(account: NonNullable<PrismaTreasuryAccount>): TreasuryAccount {
  return {
    id: account.id,
    type: account.type as TreasuryAccount["type"],
    name: account.name,
    currency: account.currency as TreasuryAccount["currency"],
    status: account.status as TreasuryAccount["status"],
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

function toTreasuryTransaction(transaction: NonNullable<PrismaTreasuryTransaction>): TreasuryTransaction {
  return {
    id: transaction.id,
    type: transaction.type as TreasuryTransaction["type"],
    debitAccountId: transaction.debitAccountId,
    creditAccountId: transaction.creditAccountId,
    amount: transaction.amount.toString(),
    currency: transaction.currency as TreasuryTransaction["currency"],
    sourceType: transaction.sourceType,
    sourceId: transaction.sourceId,
    status: transaction.status as TreasuryTransaction["status"],
    reversalOfId: transaction.reversalOfId ?? undefined,
    memo: transaction.memo ?? undefined,
    createdAt: transaction.createdAt.toISOString(),
    postedAt: transaction.postedAt?.toISOString(),
  };
}

function toFundAllocation(allocation: NonNullable<PrismaFundAllocation>): FundAllocation {
  return {
    id: allocation.id,
    sourceType: allocation.sourceType as FundAllocation["sourceType"],
    sourceId: allocation.sourceId,
    allocationType: allocation.allocationType as FundAllocation["allocationType"],
    projectId: allocation.projectId ?? undefined,
    amount: allocation.amount.toString(),
    currency: allocation.currency as FundAllocation["currency"],
    status: allocation.status as FundAllocation["status"],
    ledgerTransactionId: allocation.ledgerTransactionId ?? undefined,
    createdAt: allocation.createdAt.toISOString(),
    updatedAt: allocation.updatedAt.toISOString(),
  };
}

function toMilestoneRelease(release: NonNullable<PrismaMilestoneRelease>): ProjectMilestoneRelease {
  return {
    id: release.id,
    projectId: release.projectId,
    milestoneId: release.milestoneId,
    allocationId: release.allocationId ?? undefined,
    amount: release.amount.toString(),
    currency: release.currency as ProjectMilestoneRelease["currency"],
    status: release.status as ProjectMilestoneRelease["status"],
    ledgerTransactionId: release.ledgerTransactionId,
    createdAt: release.createdAt.toISOString(),
    updatedAt: release.updatedAt.toISOString(),
  };
}

function toSettlement(settlement: NonNullable<PrismaSettlementCertificate>): SettlementCertificate {
  return {
    id: settlement.id,
    projectId: settlement.projectId,
    milestoneId: settlement.milestoneId,
    releaseId: settlement.releaseId,
    evidenceRoot: settlement.evidenceRoot,
    amount: settlement.amount.toString(),
    currency: settlement.currency as SettlementCertificate["currency"],
    certificateId: settlement.certificateId ?? undefined,
    settlementHash: settlement.settlementHash,
    finalSettlement: settlement.finalSettlement,
    status: settlement.status as SettlementCertificate["status"],
    createdAt: settlement.createdAt.toISOString(),
    updatedAt: settlement.updatedAt.toISOString(),
  };
}

function toAuditLog(log: NonNullable<PrismaAuditLog>): AuditLog {
  return {
    id: log.id,
    actor: log.actor,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    beforeState: log.beforeState,
    afterState: log.afterState,
    requestId: log.requestId ?? undefined,
    createdAt: log.createdAt.toISOString(),
  };
}
