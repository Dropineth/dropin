import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  AuditLog,
  PaymentEvent,
  PaymentIntent,
  PaymentReconciliationReport,
  RiskEvent,
} from "@dropin/schemas";
import type { AuditInput } from "../lottery/lottery-repository.js";

export type CreatePaymentIntentInput = Omit<
  PaymentIntent,
  | "id"
  | "status"
  | "submittedTxHash"
  | "confirmedTxHash"
  | "confirmedAt"
  | "confirmedBlockTime"
  | "confirmedRawPayloadHash"
  | "verificationSource"
  | "treasuryTransactionId"
  | "reconciliationStatus"
  | "createdAt"
  | "updatedAt"
> & {
  status?: PaymentIntent["status"] | undefined;
};
export type CreatePaymentEventInput = Omit<PaymentEvent, "id" | "createdAt">;
export type CreatePaymentReconciliationReportInput = Omit<PaymentReconciliationReport, "createdAt">;
export type CreatePaymentRiskEventInput = Omit<RiskEvent, "id" | "createdAt" | "resolvedAt">;

export interface PaymentRepository {
  makeId(prefix: string): string;
  now(): string;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent>;
  updatePaymentIntent(intent: PaymentIntent): Promise<PaymentIntent>;
  getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent | undefined>;
  getPaymentIntentByIdempotencyKey(idempotencyKey: string): Promise<PaymentIntent | undefined>;
  findPaymentIntentByTxHash(txHash: string, excludeIntentId?: string): Promise<PaymentIntent | undefined>;
  listPaymentIntents(): Promise<PaymentIntent[]>;
  createPaymentEvent(input: CreatePaymentEventInput): Promise<PaymentEvent>;
  listPaymentEvents(paymentIntentId?: string): Promise<PaymentEvent[]>;
  createReconciliationReport(input: CreatePaymentReconciliationReportInput): Promise<PaymentReconciliationReport>;
  listReconciliationReports(): Promise<PaymentReconciliationReport[]>;
  createRiskEvent(input: CreatePaymentRiskEventInput): Promise<RiskEvent>;
  createAuditLog(input: AuditInput): Promise<AuditLog>;
  listAuditLogs(): Promise<AuditLog[]>;
}

export function makeId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export class InMemoryPaymentRepository implements PaymentRepository {
  readonly intents = new Map<string, PaymentIntent>();
  readonly events = new Map<string, PaymentEvent>();
  readonly reports = new Map<string, PaymentReconciliationReport>();
  readonly riskEvents = new Map<string, RiskEvent>();
  readonly auditLogs: AuditLog[] = [];

  makeId(prefix: string) {
    return makeId(prefix);
  }

  now() {
    return nowIso();
  }

  async createPaymentIntent(input: CreatePaymentIntentInput) {
    const now = this.now();
    const intent: PaymentIntent = {
      ...input,
      id: this.makeId("payment_intent"),
      status: input.status ?? "awaiting_payment",
      createdAt: now,
      updatedAt: now,
    };
    this.intents.set(intent.id, intent);
    return intent;
  }

  async updatePaymentIntent(intent: PaymentIntent) {
    const updated: PaymentIntent = { ...intent, updatedAt: this.now() };
    this.intents.set(intent.id, updated);
    return updated;
  }

  async getPaymentIntent(paymentIntentId: string) {
    return this.intents.get(paymentIntentId);
  }

  async getPaymentIntentByIdempotencyKey(idempotencyKey: string) {
    return [...this.intents.values()].find((intent) => intent.idempotencyKey === idempotencyKey);
  }

  async findPaymentIntentByTxHash(txHash: string, excludeIntentId?: string) {
    return [...this.intents.values()].find(
      (intent) =>
        intent.id !== excludeIntentId &&
        (intent.submittedTxHash === txHash || intent.confirmedTxHash === txHash),
    );
  }

  async listPaymentIntents() {
    return [...this.intents.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async createPaymentEvent(input: CreatePaymentEventInput) {
    const event: PaymentEvent = {
      ...input,
      id: this.makeId("payment_event"),
      createdAt: this.now(),
    };
    this.events.set(event.id, event);
    return event;
  }

  async listPaymentEvents(paymentIntentId?: string) {
    return [...this.events.values()]
      .filter((event) => !paymentIntentId || event.paymentIntentId === paymentIntentId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async createReconciliationReport(input: CreatePaymentReconciliationReportInput) {
    const report: PaymentReconciliationReport = {
      ...input,
      createdAt: this.now(),
    };
    this.reports.set(report.id, report);
    return report;
  }

  async listReconciliationReports() {
    return [...this.reports.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async createRiskEvent(input: CreatePaymentRiskEventInput) {
    const event: RiskEvent = {
      ...input,
      id: this.makeId("risk_event"),
      createdAt: this.now(),
    };
    this.riskEvents.set(event.id, event);
    return event;
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

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(readonly prisma: PrismaClient) {}

  makeId(prefix: string) {
    return makeId(prefix);
  }

  now() {
    return nowIso();
  }

  async createPaymentIntent(input: CreatePaymentIntentInput) {
    const created = await this.prisma.paymentIntent.create({
      data: {
        id: this.makeId("payment_intent"),
        userId: input.userId,
        wallet: input.wallet,
        purpose: input.purpose,
        purposeId: input.purposeId,
        chain: input.chain,
        currency: input.currency,
        amount: input.amount,
        status: input.status ?? "awaiting_payment",
        expectedRecipient: input.expectedRecipient,
        paymentNonce: input.paymentNonce ?? null,
        expectedMemo: input.expectedMemo ?? null,
        expiresAt: new Date(input.expiresAt),
        idempotencyKey: input.idempotencyKey ?? null,
        metadata: jsonValue(input.metadata),
      },
    });
    return toPaymentIntent(created);
  }

  async updatePaymentIntent(intent: PaymentIntent) {
    const updated = await this.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: intent.status,
        submittedTxHash: intent.submittedTxHash ?? null,
        confirmedTxHash: intent.confirmedTxHash ?? null,
        confirmedAt: intent.confirmedAt ? new Date(intent.confirmedAt) : null,
        confirmedBlockTime: intent.confirmedBlockTime ? new Date(intent.confirmedBlockTime) : null,
        confirmedRawPayloadHash: intent.confirmedRawPayloadHash ?? null,
        verificationSource: intent.verificationSource ?? null,
        paymentNonce: intent.paymentNonce ?? null,
        expectedMemo: intent.expectedMemo ?? null,
        metadata: jsonValue(intent.metadata),
        treasuryTransactionId: intent.treasuryTransactionId ?? null,
        reconciliationStatus: intent.reconciliationStatus ?? null,
        expiresAt: new Date(intent.expiresAt),
      },
    });
    return toPaymentIntent(updated);
  }

  async getPaymentIntent(paymentIntentId: string) {
    const intent = await this.prisma.paymentIntent.findUnique({ where: { id: paymentIntentId } });
    return intent ? toPaymentIntent(intent) : undefined;
  }

  async getPaymentIntentByIdempotencyKey(idempotencyKey: string) {
    const intent = await this.prisma.paymentIntent.findUnique({ where: { idempotencyKey } });
    return intent ? toPaymentIntent(intent) : undefined;
  }

  async findPaymentIntentByTxHash(txHash: string, excludeIntentId?: string) {
    const intent = await this.prisma.paymentIntent.findFirst({
      where: {
        ...(excludeIntentId ? { id: { not: excludeIntentId } } : {}),
        OR: [{ submittedTxHash: txHash }, { confirmedTxHash: txHash }],
      },
    });
    return intent ? toPaymentIntent(intent) : undefined;
  }

  async listPaymentIntents() {
    const intents = await this.prisma.paymentIntent.findMany({ orderBy: { createdAt: "desc" } });
    return intents.map(toPaymentIntent);
  }

  async createPaymentEvent(input: CreatePaymentEventInput) {
    const event = await this.prisma.paymentEvent.create({
      data: {
        id: this.makeId("payment_event"),
        paymentIntentId: input.paymentIntentId,
        type: input.type,
        txHash: input.txHash ?? null,
        metadata: input.metadata === undefined ? Prisma.JsonNull : jsonValue(input.metadata),
      },
    });
    return toPaymentEvent(event);
  }

  async listPaymentEvents(paymentIntentId?: string) {
    const events = await this.prisma.paymentEvent.findMany({
      ...(paymentIntentId ? { where: { paymentIntentId } } : {}),
      orderBy: { createdAt: "asc" },
    });
    return events.map(toPaymentEvent);
  }

  async createReconciliationReport(input: CreatePaymentReconciliationReportInput) {
    const created = await this.prisma.paymentReconciliationReport.create({
      data: {
        id: input.id,
        status: input.status,
        checkedIntentCount: input.checkedIntentCount,
        duplicateTxCount: input.duplicateTxCount,
        amountMismatchCount: input.amountMismatchCount,
        currencyMismatchCount: input.currencyMismatchCount,
        stalePendingCount: input.stalePendingCount,
        anomalies: jsonValue(input.anomalies),
      },
    });
    return toPaymentReconciliationReport(created);
  }

  async listReconciliationReports() {
    const reports = await this.prisma.paymentReconciliationReport.findMany({ orderBy: { createdAt: "desc" } });
    return reports.map(toPaymentReconciliationReport);
  }

  async createRiskEvent(input: CreatePaymentRiskEventInput) {
    const event = await this.prisma.riskEvent.create({
      data: {
        id: this.makeId("risk_event"),
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        riskLevel: input.riskLevel,
        score: input.score,
        recommendedAction: input.recommendedAction,
        reasonCodes: input.reasonCodes,
        status: input.status,
        resolution: input.resolution ?? null,
      },
    });
    return {
      id: event.id,
      subjectType: event.subjectType,
      subjectId: event.subjectId,
      riskLevel: event.riskLevel as RiskEvent["riskLevel"],
      score: Number(event.score),
      recommendedAction: event.recommendedAction as RiskEvent["recommendedAction"],
      reasonCodes: event.reasonCodes as string[],
      status: event.status as RiskEvent["status"],
      resolution: event.resolution ?? undefined,
      createdAt: event.createdAt.toISOString(),
      resolvedAt: event.resolvedAt?.toISOString(),
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

type PrismaPaymentIntent = Awaited<ReturnType<PrismaClient["paymentIntent"]["findFirst"]>>;
type PrismaPaymentEvent = Awaited<ReturnType<PrismaClient["paymentEvent"]["findFirst"]>>;
type PrismaPaymentReport = Awaited<ReturnType<PrismaClient["paymentReconciliationReport"]["findFirst"]>>;

function toPaymentIntent(intent: NonNullable<PrismaPaymentIntent>): PaymentIntent {
  return {
    id: intent.id,
    userId: intent.userId,
    wallet: intent.wallet,
    purpose: intent.purpose as PaymentIntent["purpose"],
    purposeId: intent.purposeId,
    chain: intent.chain as PaymentIntent["chain"],
    currency: intent.currency as PaymentIntent["currency"],
    amount: intent.amount.toString(),
    status: intent.status as PaymentIntent["status"],
    expectedRecipient: intent.expectedRecipient,
    paymentNonce: intent.paymentNonce ?? undefined,
    expectedMemo: intent.expectedMemo ?? undefined,
    submittedTxHash: intent.submittedTxHash ?? undefined,
    confirmedTxHash: intent.confirmedTxHash ?? undefined,
    confirmedAt: intent.confirmedAt?.toISOString(),
    confirmedBlockTime: intent.confirmedBlockTime?.toISOString(),
    confirmedRawPayloadHash: intent.confirmedRawPayloadHash ?? undefined,
    verificationSource: intent.verificationSource ?? undefined,
    expiresAt: intent.expiresAt.toISOString(),
    idempotencyKey: intent.idempotencyKey ?? undefined,
    metadata: (intent.metadata as Record<string, unknown>) ?? {},
    treasuryTransactionId: intent.treasuryTransactionId ?? undefined,
    reconciliationStatus: (intent.reconciliationStatus as PaymentIntent["reconciliationStatus"]) ?? undefined,
    createdAt: intent.createdAt.toISOString(),
    updatedAt: intent.updatedAt.toISOString(),
  };
}

function toPaymentEvent(event: NonNullable<PrismaPaymentEvent>): PaymentEvent {
  return {
    id: event.id,
    paymentIntentId: event.paymentIntentId,
    type: event.type as PaymentEvent["type"],
    txHash: event.txHash ?? undefined,
    metadata: event.metadata ?? undefined,
    createdAt: event.createdAt.toISOString(),
  };
}

function toPaymentReconciliationReport(report: NonNullable<PrismaPaymentReport>): PaymentReconciliationReport {
  return {
    id: report.id,
    status: report.status as PaymentReconciliationReport["status"],
    checkedIntentCount: report.checkedIntentCount,
    duplicateTxCount: report.duplicateTxCount,
    amountMismatchCount: report.amountMismatchCount,
    currencyMismatchCount: report.currencyMismatchCount,
    stalePendingCount: report.stalePendingCount,
    anomalies: report.anomalies as PaymentReconciliationReport["anomalies"],
    createdAt: report.createdAt.toISOString(),
  };
}

function jsonValue(input: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue;
}
