import { createHmac, timingSafeEqual } from "node:crypto";
import type { z } from "zod";
import { telegramSessionSchema, telegramUserPayloadSchema } from "@dropin/schemas";
import { TelegramAuthError } from "./telegram-errors.js";

export type TelegramUserPayload = z.infer<typeof telegramUserPayloadSchema>;

export function validateTelegramSession(input: unknown, options: { mode?: string | undefined; botToken?: string | undefined }) {
  const parsed = telegramSessionSchema.parse(input);
  if ((options.mode ?? "mock") === "mock") {
    if (!parsed.user) {
      throw new TelegramAuthError("Mock Telegram auth requires a user payload.");
    }
    return { user: parsed.user, initDataValid: true };
  }

  if (!parsed.initData) {
    throw new TelegramAuthError("Strict Telegram auth requires initData.");
  }
  if (!options.botToken) {
    throw new TelegramAuthError("Strict Telegram auth requires TELEGRAM_BOT_TOKEN.");
  }

  const user = validateInitData(parsed.initData, options.botToken);
  return { user, initDataValid: true };
}

export function validateInitData(initData: string, botToken: string): TelegramUserPayload {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    throw new TelegramAuthError("Telegram initData is missing hash.");
  }
  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!safeEqualHex(hash, expected)) {
    throw new TelegramAuthError("Telegram initData hash mismatch.");
  }
  const userRaw = params.get("user");
  if (!userRaw) {
    throw new TelegramAuthError("Telegram initData is missing user.");
  }
  const userJson = JSON.parse(userRaw) as {
    id: number | string;
    username?: string;
    first_name?: string;
    last_name?: string;
    language_code?: string;
  };
  return telegramUserPayloadSchema.parse({
    id: userJson.id,
    username: userJson.username,
    firstName: userJson.first_name,
    lastName: userJson.last_name,
    languageCode: userJson.language_code,
  });
}

function safeEqualHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}
