import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

// Ensure API processes started from apps/api (or turbo) still read root .env.
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootEnvPath = path.resolve(currentDir, "../../../.env");
loadDotenv({ path: repoRootEnvPath });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:4000"),
  /** Comma-separated origins, or "true"/"*" for permissive (dev only). */
  CORS_ORIGINS: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid API environment:", parsed.error.flatten());
  process.exit(1);
}

export const env = parsed.data;

if (env.NODE_ENV === "production" && !env.BETTER_AUTH_SECRET) {
  console.error(
    "Invalid API environment: BETTER_AUTH_SECRET is required in production.",
  );
  process.exit(1);
}

/** Resolve CORS origin option for @fastify/cors. */
export function getCorsOrigin(): true | string | string[] {
  const raw = env.CORS_ORIGINS?.trim();
  if (raw === undefined || raw === "" || raw === "true" || raw === "*") {
    return true;
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Resolve trusted origins for Better Auth. */
export function getTrustedOrigins(): string[] {
  const raw = env.CORS_ORIGINS?.trim();
  if (!raw || raw === "true" || raw === "*") {
    return ["http://localhost:5173"];
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}
