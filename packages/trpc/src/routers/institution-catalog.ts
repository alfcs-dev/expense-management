import { db } from "@expense-management/db";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

export const institutionCatalogRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          query: z.string().trim().max(120).optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const query = input?.query?.trim() ?? "";
      const limit = input?.limit ?? 30;

      return db.institutionCatalog.findMany({
        where: {
          isActive: true,
          OR: query
            ? [
                { code: { contains: query } },
                { bankCode: { contains: query } },
                { name: { contains: query, mode: "insensitive" } },
              ]
            : undefined,
        },
        orderBy: [{ name: "asc" }],
        take: limit,
      });
    }),
});
