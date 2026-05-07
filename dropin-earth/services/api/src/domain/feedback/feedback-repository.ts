import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { AuditLog, FeedbackItem } from "@dropin/schemas";
import type { AuditInput } from "../lottery/lottery-repository.js";

export type CreateFeedbackInput = Omit<FeedbackItem, "id" | "status" | "resolution" | "resolvedBy" | "resolvedAt" | "createdAt" | "updatedAt">;

export interface FeedbackRepository {
  makeId(prefix: string): string;
  now(): string;
  createFeedback(input: CreateFeedbackInput): Promise<FeedbackItem>;
  getFeedback(feedbackId: string): Promise<FeedbackItem | undefined>;
  listFeedback(): Promise<FeedbackItem[]>;
  updateFeedback(item: FeedbackItem): Promise<FeedbackItem>;
  createAuditLog(input: AuditInput): Promise<AuditLog>;
  listAuditLogs(): Promise<AuditLog[]>;
}

export function makeId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export class InMemoryFeedbackRepository implements FeedbackRepository {
  readonly feedback = new Map<string, FeedbackItem>();
  readonly auditLogs: AuditLog[] = [];

  makeId(prefix: string) {
    return makeId(prefix);
  }

  now() {
    return nowIso();
  }

  async createFeedback(input: CreateFeedbackInput) {
    const now = this.now();
    const item: FeedbackItem = {
      ...input,
      id: this.makeId("feedback"),
      status: "open",
      createdAt: now,
      updatedAt: now,
    };
    this.feedback.set(item.id, item);
    return item;
  }

  async getFeedback(feedbackId: string) {
    return this.feedback.get(feedbackId);
  }

  async listFeedback() {
    return [...this.feedback.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async updateFeedback(item: FeedbackItem) {
    const updated = { ...item, updatedAt: this.now() };
    this.feedback.set(item.id, updated);
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
}

export class PrismaFeedbackRepository implements FeedbackRepository {
  constructor(readonly prisma: PrismaClient) {}

  makeId(prefix: string) {
    return makeId(prefix);
  }

  now() {
    return nowIso();
  }

  async createFeedback(input: CreateFeedbackInput) {
    const created = await this.prisma.feedbackItem.create({
      data: {
        id: this.makeId("feedback"),
        source: input.source,
        userId: input.userId ?? null,
        wallet: input.wallet ?? null,
        campaignId: input.campaignId ?? null,
        roundId: input.roundId ?? null,
        page: input.page ?? null,
        category: input.category,
        message: input.message,
        severity: input.severity,
        status: "open",
        metadata: jsonValue(input.metadata),
      },
    });
    return toFeedback(created);
  }

  async getFeedback(feedbackId: string) {
    const item = await this.prisma.feedbackItem.findUnique({ where: { id: feedbackId } });
    return item ? toFeedback(item) : undefined;
  }

  async listFeedback() {
    const items = await this.prisma.feedbackItem.findMany({ orderBy: { createdAt: "desc" } });
    return items.map(toFeedback);
  }

  async updateFeedback(item: FeedbackItem) {
    const updated = await this.prisma.feedbackItem.update({
      where: { id: item.id },
      data: {
        status: item.status,
        resolution: item.resolution ?? null,
        resolvedBy: item.resolvedBy ?? null,
        resolvedAt: item.resolvedAt ? new Date(item.resolvedAt) : null,
        metadata: jsonValue(item.metadata),
      },
    });
    return toFeedback(updated);
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

type PrismaFeedback = Awaited<ReturnType<PrismaClient["feedbackItem"]["findFirst"]>>;

function toFeedback(item: NonNullable<PrismaFeedback>): FeedbackItem {
  return {
    id: item.id,
    source: item.source as FeedbackItem["source"],
    userId: item.userId ?? undefined,
    wallet: item.wallet ?? undefined,
    campaignId: item.campaignId ?? undefined,
    roundId: item.roundId ?? undefined,
    page: item.page ?? undefined,
    category: item.category,
    message: item.message,
    severity: item.severity as FeedbackItem["severity"],
    status: item.status as FeedbackItem["status"],
    metadata: item.metadata as FeedbackItem["metadata"],
    resolution: item.resolution ?? undefined,
    resolvedBy: item.resolvedBy ?? undefined,
    resolvedAt: item.resolvedAt?.toISOString(),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
