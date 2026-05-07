import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { ReferralCode, ReferralEvent, ShareCard, TelegramAccount } from "@dropin/schemas";

export type UpsertTelegramAccountInput = Omit<TelegramAccount, "id" | "createdAt" | "updatedAt">;
export type CreateReferralCodeInput = Omit<ReferralCode, "id" | "createdAt">;
export type CreateReferralEventInput = Omit<ReferralEvent, "id" | "createdAt">;
export type CreateShareCardInput = Omit<ShareCard, "id" | "createdAt">;

export interface TelegramRepository {
  makeId(prefix: string): string;
  now(): string;
  upsertTelegramAccount(input: UpsertTelegramAccountInput): Promise<TelegramAccount>;
  getTelegramAccountByTelegramId(telegramUserId: string): Promise<TelegramAccount | undefined>;
  getTelegramAccountByLinkedUserId(userId: string): Promise<TelegramAccount | undefined>;
  createReferralCode(input: CreateReferralCodeInput): Promise<ReferralCode>;
  getReferralCode(code: string): Promise<ReferralCode | undefined>;
  getReferralCodeBySource(sourceType: ReferralCode["sourceType"], sourceId: string, ownerUserId: string): Promise<ReferralCode | undefined>;
  createReferralEvent(input: CreateReferralEventInput): Promise<ReferralEvent>;
  getReferralEvent(code: string, identity: { telegramUserId?: string | undefined; userId?: string | undefined }): Promise<ReferralEvent | undefined>;
  listReferralEventsForUser(userId: string): Promise<ReferralEvent[]>;
  createShareCard(input: CreateShareCardInput): Promise<ShareCard>;
  getShareCard(shareCardId: string): Promise<ShareCard | undefined>;
  listShareCardsForUser(userId: string): Promise<ShareCard[]>;
}

export function makeId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export class InMemoryTelegramRepository implements TelegramRepository {
  readonly accounts = new Map<string, TelegramAccount>();
  readonly referralCodes = new Map<string, ReferralCode>();
  readonly referralEvents = new Map<string, ReferralEvent>();
  readonly shareCards = new Map<string, ShareCard>();

  makeId(prefix: string) {
    return makeId(prefix);
  }

  now() {
    return nowIso();
  }

  async upsertTelegramAccount(input: UpsertTelegramAccountInput) {
    const existing = [...this.accounts.values()].find((account) => account.telegramUserId === input.telegramUserId);
    const now = this.now();
    const account: TelegramAccount = {
      ...input,
      id: existing?.id ?? this.makeId("telegram_account"),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.accounts.set(account.id, account);
    return account;
  }

  async getTelegramAccountByTelegramId(telegramUserId: string) {
    return [...this.accounts.values()].find((account) => account.telegramUserId === telegramUserId);
  }

  async getTelegramAccountByLinkedUserId(userId: string) {
    return [...this.accounts.values()].find((account) => account.linkedUserId === userId);
  }

  async createReferralCode(input: CreateReferralCodeInput) {
    const existing = this.referralCodes.get(input.code);
    if (existing) {
      return existing;
    }
    const code: ReferralCode = {
      ...input,
      id: this.makeId("referral_code"),
      createdAt: this.now(),
    };
    this.referralCodes.set(code.code, code);
    return code;
  }

  async getReferralCode(code: string) {
    return this.referralCodes.get(code);
  }

  async getReferralCodeBySource(sourceType: ReferralCode["sourceType"], sourceId: string, ownerUserId: string) {
    return [...this.referralCodes.values()].find(
      (code) => code.sourceType === sourceType && code.sourceId === sourceId && code.ownerUserId === ownerUserId,
    );
  }

  async createReferralEvent(input: CreateReferralEventInput) {
    const event: ReferralEvent = {
      ...input,
      id: this.makeId("referral_event"),
      createdAt: this.now(),
    };
    this.referralEvents.set(event.id, event);
    return event;
  }

  async getReferralEvent(code: string, identity: { telegramUserId?: string | undefined; userId?: string | undefined }) {
    return [...this.referralEvents.values()].find(
      (event) =>
        event.code === code &&
        ((identity.telegramUserId && event.referredTelegramUserId === identity.telegramUserId) ||
          (identity.userId && event.referredUserId === identity.userId)),
    );
  }

  async listReferralEventsForUser(userId: string) {
    return [...this.referralEvents.values()].filter((event) => event.referrerUserId === userId);
  }

  async createShareCard(input: CreateShareCardInput) {
    const card: ShareCard = {
      ...input,
      id: this.makeId("share_card"),
      createdAt: this.now(),
    };
    this.shareCards.set(card.id, card);
    return card;
  }

  async getShareCard(shareCardId: string) {
    return this.shareCards.get(shareCardId);
  }

  async listShareCardsForUser(userId: string) {
    return [...this.shareCards.values()].filter((card) => card.ownerUserId === userId);
  }
}

export class PrismaTelegramRepository implements TelegramRepository {
  constructor(readonly prisma: PrismaClient) {}

  makeId(prefix: string) {
    return makeId(prefix);
  }

  now() {
    return nowIso();
  }

  async upsertTelegramAccount(input: UpsertTelegramAccountInput) {
    const account = await this.prisma.telegramAccount.upsert({
      where: { telegramUserId: input.telegramUserId },
      update: {
        username: input.username ?? null,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        languageCode: input.languageCode ?? null,
        linkedUserId: input.linkedUserId,
        wallet: input.wallet ?? null,
      },
      create: {
        id: this.makeId("telegram_account"),
        telegramUserId: input.telegramUserId,
        username: input.username ?? null,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        languageCode: input.languageCode ?? null,
        linkedUserId: input.linkedUserId,
        wallet: input.wallet ?? null,
      },
    });
    return toTelegramAccount(account);
  }

  async getTelegramAccountByTelegramId(telegramUserId: string) {
    const account = await this.prisma.telegramAccount.findUnique({ where: { telegramUserId } });
    return account ? toTelegramAccount(account) : undefined;
  }

  async getTelegramAccountByLinkedUserId(userId: string) {
    const account = await this.prisma.telegramAccount.findFirst({ where: { linkedUserId: userId } });
    return account ? toTelegramAccount(account) : undefined;
  }

  async createReferralCode(input: CreateReferralCodeInput) {
    const code = await this.prisma.referralCode.upsert({
      where: { code: input.code },
      update: {
        status: input.status,
      },
      create: {
        id: this.makeId("referral_code"),
        code: input.code,
        ownerUserId: input.ownerUserId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        status: input.status,
      },
    });
    return toReferralCode(code);
  }

  async getReferralCode(code: string) {
    const referral = await this.prisma.referralCode.findUnique({ where: { code } });
    return referral ? toReferralCode(referral) : undefined;
  }

  async getReferralCodeBySource(sourceType: ReferralCode["sourceType"], sourceId: string, ownerUserId: string) {
    const referral = await this.prisma.referralCode.findFirst({ where: { sourceType, sourceId, ownerUserId } });
    return referral ? toReferralCode(referral) : undefined;
  }

  async createReferralEvent(input: CreateReferralEventInput) {
    const event = await this.prisma.referralEvent.create({
      data: {
        id: this.makeId("referral_event"),
        code: input.code,
        referrerUserId: input.referrerUserId,
        referredTelegramUserId: input.referredTelegramUserId ?? null,
        referredUserId: input.referredUserId ?? null,
        roundId: input.roundId ?? null,
        status: input.status,
        riskScoreSnapshot: input.riskScoreSnapshot === undefined ? Prisma.JsonNull : jsonValue(input.riskScoreSnapshot),
        leafPoints: input.leafPoints,
      },
    });
    return toReferralEvent(event);
  }

  async getReferralEvent(code: string, identity: { telegramUserId?: string | undefined; userId?: string | undefined }) {
    const event = await this.prisma.referralEvent.findFirst({
      where: {
        code,
        OR: [
          ...(identity.telegramUserId ? [{ referredTelegramUserId: identity.telegramUserId }] : []),
          ...(identity.userId ? [{ referredUserId: identity.userId }] : []),
        ],
      },
    });
    return event ? toReferralEvent(event) : undefined;
  }

  async listReferralEventsForUser(userId: string) {
    const events = await this.prisma.referralEvent.findMany({ where: { referrerUserId: userId }, orderBy: { createdAt: "desc" } });
    return events.map(toReferralEvent);
  }

  async createShareCard(input: CreateShareCardInput) {
    const card = await this.prisma.shareCard.create({
      data: {
        id: this.makeId("share_card"),
        ticketId: input.ticketId ?? null,
        roundId: input.roundId,
        ownerUserId: input.ownerUserId,
        referralCode: input.referralCode,
        title: input.title,
        copy: input.copy,
        url: input.url,
        status: input.status,
      },
    });
    return toShareCard(card);
  }

  async getShareCard(shareCardId: string) {
    const card = await this.prisma.shareCard.findUnique({ where: { id: shareCardId } });
    return card ? toShareCard(card) : undefined;
  }

  async listShareCardsForUser(userId: string) {
    const cards = await this.prisma.shareCard.findMany({ where: { ownerUserId: userId }, orderBy: { createdAt: "desc" } });
    return cards.map(toShareCard);
  }
}

type PrismaTelegramAccount = Awaited<ReturnType<PrismaClient["telegramAccount"]["findFirst"]>>;
type PrismaReferralCode = Awaited<ReturnType<PrismaClient["referralCode"]["findFirst"]>>;
type PrismaReferralEvent = Awaited<ReturnType<PrismaClient["referralEvent"]["findFirst"]>>;
type PrismaShareCard = Awaited<ReturnType<PrismaClient["shareCard"]["findFirst"]>>;

function toTelegramAccount(account: NonNullable<PrismaTelegramAccount>): TelegramAccount {
  return {
    id: account.id,
    telegramUserId: account.telegramUserId,
    username: account.username ?? undefined,
    firstName: account.firstName ?? undefined,
    lastName: account.lastName ?? undefined,
    languageCode: account.languageCode ?? undefined,
    linkedUserId: account.linkedUserId,
    wallet: account.wallet ?? undefined,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

function toReferralCode(code: NonNullable<PrismaReferralCode>): ReferralCode {
  return {
    id: code.id,
    code: code.code,
    ownerUserId: code.ownerUserId,
    sourceType: code.sourceType as ReferralCode["sourceType"],
    sourceId: code.sourceId,
    status: code.status as ReferralCode["status"],
    createdAt: code.createdAt.toISOString(),
  };
}

function toReferralEvent(event: NonNullable<PrismaReferralEvent>): ReferralEvent {
  return {
    id: event.id,
    code: event.code,
    referrerUserId: event.referrerUserId,
    referredTelegramUserId: event.referredTelegramUserId ?? undefined,
    referredUserId: event.referredUserId ?? undefined,
    roundId: event.roundId ?? undefined,
    status: event.status as ReferralEvent["status"],
    riskScoreSnapshot: event.riskScoreSnapshot ?? undefined,
    leafPoints: event.leafPoints,
    createdAt: event.createdAt.toISOString(),
  };
}

function toShareCard(card: NonNullable<PrismaShareCard>): ShareCard {
  return {
    id: card.id,
    ticketId: card.ticketId ?? undefined,
    roundId: card.roundId,
    ownerUserId: card.ownerUserId,
    referralCode: card.referralCode,
    title: card.title,
    copy: card.copy,
    url: card.url,
    status: card.status as ShareCard["status"],
    createdAt: card.createdAt.toISOString(),
  };
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
