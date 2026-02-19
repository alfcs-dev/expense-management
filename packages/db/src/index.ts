import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import prismaClientModule from "@prisma/client";
import type { PrismaClient as PrismaClientType } from "@prisma/client";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootEnvPath = path.resolve(currentDir, "../../../.env");
loadDotenv({ path: repoRootEnvPath });

const { PrismaClient } = prismaClientModule;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClientType };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
