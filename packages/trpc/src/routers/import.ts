import { TRPCError } from "@trpc/server";
import { db } from "@expense-management/db";
import { currencySchema, idSchema } from "@expense-management/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

type ParsedRow = {
  date: Date;
  amount: number;
  description: string;
};

const importInputSchema = z.object({
  format: z.enum(["csv", "ofx"]),
  content: z.string().min(1),
});

const importApplySchema = importInputSchema.extend({
  accountId: idSchema,
  categoryId: idSchema,
  currency: currencySchema,
});

function requireUserId(user: { id: string } | null): string {
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  return user.id;
}

function parseDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{8}/.test(trimmed)) {
    const year = Number(trimmed.slice(0, 4));
    const month = Number(trimmed.slice(4, 6));
    const day = Number(trimmed.slice(6, 8));
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseAmountToCents(value: string): number | null {
  const normalized = value.replace(/[$,\s]/g, "");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(Math.abs(parsed) * 100);
}

function parseCsvRows(content: string): ParsedRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return [];

  const [headerLine, ...dataLines] = lines;
  const headers = headerLine.split(",").map((h) => h.trim().toLowerCase());
  const dateIndex = headers.findIndex((h) => ["date", "fecha", "dtposted"].includes(h));
  const amountIndex = headers.findIndex((h) => ["amount", "monto", "trnamt"].includes(h));
  const descriptionIndex = headers.findIndex((h) =>
    ["description", "descripcion", "memo", "name", "concepto"].includes(h),
  );

  const rows: ParsedRow[] = [];
  for (const line of dataLines) {
    const parts = line.split(",");
    const date = parseDate(parts[dateIndex >= 0 ? dateIndex : 0] ?? "");
    const amount = parseAmountToCents(parts[amountIndex >= 0 ? amountIndex : 1] ?? "");
    const description = (parts[descriptionIndex >= 0 ? descriptionIndex : 2] ?? "").trim();
    if (!date || amount == null || !description) continue;
    rows.push({
      date,
      amount,
      description,
    });
  }
  return rows;
}

function parseTag(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([^\\r\\n<]+)`, "i");
  return block.match(regex)?.[1]?.trim() ?? "";
}

function parseOfxRows(content: string): ParsedRow[] {
  const blocks = content.split(/<STMTTRN>/i).slice(1);
  const rows: ParsedRow[] = [];

  for (const block of blocks) {
    const date = parseDate(parseTag(block, "DTPOSTED"));
    const amount = parseAmountToCents(parseTag(block, "TRNAMT"));
    const description =
      parseTag(block, "NAME") || parseTag(block, "MEMO") || "Imported OFX transaction";
    if (!date || amount == null || !description) continue;
    rows.push({
      date,
      amount,
      description,
    });
  }

  return rows;
}

function parseRows(input: { format: "csv" | "ofx"; content: string }): ParsedRow[] {
  return input.format === "csv"
    ? parseCsvRows(input.content)
    : parseOfxRows(input.content);
}

async function assertOwnedAccountAndCategory(
  userId: string,
  accountId: string,
  categoryId: string,
): Promise<void> {
  const [accountCount, categoryCount] = await Promise.all([
    db.account.count({ where: { userId, id: accountId } }),
    db.category.count({ where: { userId, id: categoryId } }),
  ]);
  if (accountCount === 0 || categoryCount === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Account or category not found for current user",
    });
  }
}

async function getOrCreateBudgetIdForDate(userId: string, date: Date): Promise<string> {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const budget = await db.budget.upsert({
    where: {
      userId_month_year: {
        userId,
        month,
        year,
      },
    },
    update: {},
    create: {
      userId,
      month,
      year,
      name: `${year}-${String(month).padStart(2, "0")}`,
    },
    select: { id: true },
  });
  return budget.id;
}

export const importRouter = router({
  previewTransactions: protectedProcedure
    .input(importInputSchema)
    .query(({ input }) => {
      const rows = parseRows(input);
      return {
        count: rows.length,
        rows: rows.slice(0, 200).map((row) => ({
          date: row.date,
          amount: row.amount,
          description: row.description,
        })),
      };
    }),

  applyTransactions: protectedProcedure
    .input(importApplySchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      await assertOwnedAccountAndCategory(userId, input.accountId, input.categoryId);
      const rows = parseRows(input);
      let created = 0;

      for (const row of rows) {
        const budgetId = await getOrCreateBudgetIdForDate(userId, row.date);
        await db.expense.create({
          data: {
            userId,
            budgetId,
            categoryId: input.categoryId,
            accountId: input.accountId,
            description:
              input.format === "ofx"
                ? `[OFX] ${row.description}`
                : row.description,
            amount: row.amount,
            currency: input.currency,
            date: row.date,
            source: "csv",
          },
        });
        created += 1;
      }

      return {
        parsed: rows.length,
        created,
        source: "csv",
      };
    }),
});
