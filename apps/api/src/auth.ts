import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@expense-management/db";
import { env, getTrustedOrigins } from "./env";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: getTrustedOrigins(),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    modelName: "User",
  },
  session: {
    modelName: "AuthSession",
    cookieCache: {
      enabled: true,
      strategy: "jwt",
    },
  },
  account: {
    modelName: "AuthAccount",
  },
  verification: {
    modelName: "AuthVerification",
  },
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
  },
});
