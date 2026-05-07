import { PrismaClient } from "@prisma/client";

export function ensureDatabaseUrl() {
  process.env.DATABASE_URL ??= "postgresql://dropin:dropin@localhost:5432/dropin_earth";
}

let prisma: PrismaClient | undefined;

export function getPrisma() {
  ensureDatabaseUrl();
  prisma ??= new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
  return prisma;
}
