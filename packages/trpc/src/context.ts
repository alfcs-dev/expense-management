import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";

export type User = { id: string; email: string; name: string | null };

export type Context = {
  req: CreateFastifyContextOptions["req"];
  res: CreateFastifyContextOptions["res"];
  user: User | null;
};

/** Options for createContext; only req, res, and optional user (no adapter-only fields like info). */
export type CreateContextOptions = {
  req: CreateFastifyContextOptions["req"];
  res: CreateFastifyContextOptions["res"];
  user?: User | null;
};

export function createContext({ req, res, user }: CreateContextOptions): Context {
  return {
    req,
    res,
    user: user ?? null,
  };
}
