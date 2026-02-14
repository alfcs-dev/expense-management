import { TRPCError } from "@trpc/server";
import { db } from "@expense-management/db";
import { currencySchema, idSchema } from "@expense-management/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

const installmentPlanInputSchema = z.object({
  accountId: idSchema,
  categoryId: idSchema,
  description: z.string().trim().min(1).max(200),
  totalAmount: z.number().int().positive(),
  currency: currencySchema,
  months: z.number().int().min(1).max(120),
  interestRate: z.number().min(0).max(100).optional(),
  startDate: z.coerce.date(),
  status: z.enum(["active", "completed", "cancelled"]).optional(),
});

function requireUserId(user: { id: string } | null): string {
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  return user.id;
}

function addMonths(base: Date, monthsToAdd: number): Date {
  const result = new Date(base);
  const day = result.getDate();
  result.setMonth(result.getMonth() + monthsToAdd);
  if (result.getDate() < day) {
    result.setDate(0);
  }
  return result;
}

function splitInstallmentAmounts(totalAmount: number, months: number): number[] {
  const base = Math.floor(totalAmount / months);
  let remainder = totalAmount - base * months;
  const amounts = Array.from({ length: months }, () => base);

  for (let index = 0; index < months && remainder > 0; index += 1) {
    amounts[index] += 1;
    remainder -= 1;
  }

  return amounts;
}

async function assertOwnedCreditAccountAndCategory(
  userId: string,
  input: z.infer<typeof installmentPlanInputSchema>,
): Promise<void> {
  const [account, categoryCount] = await Promise.all([
    db.account.findFirst({
      where: {
        id: input.accountId,
        userId,
      },
      select: {
        id: true,
        type: true,
      },
    }),
    db.category.count({
      where: {
        id: input.categoryId,
        userId,
      },
    }),
  ]);

  if (!account) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Account not found for current user",
    });
  }

  if (account.type !== "credit") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Installment plans require a credit account",
    });
  }

  if (categoryCount === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Category not found for current user",
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
    select: {
      id: true,
    },
  });

  return budget.id;
}

async function recreateInstallmentExpenses(
  userId: string,
  plan: {
    id: string;
    accountId: string;
    categoryId: string;
    description: string;
    totalAmount: number;
    currency: "MXN" | "USD";
    months: number;
    startDate: Date;
  },
) {
  await db.expense.deleteMany({
    where: {
      userId,
      installmentPlanId: plan.id,
    },
  });

  const amounts = splitInstallmentAmounts(plan.totalAmount, plan.months);
  const rows: Array<{
    userId: string;
    budgetId: string;
    categoryId: string;
    accountId: string;
    installmentPlanId: string;
    description: string;
    amount: number;
    currency: "MXN" | "USD";
    date: Date;
    installmentNumber: number;
    source: "installment";
  }> = [];

  for (let index = 0; index < plan.months; index += 1) {
    const installmentDate = addMonths(plan.startDate, index);
    const budgetId = await getOrCreateBudgetIdForDate(userId, installmentDate);
    rows.push({
      userId,
      budgetId,
      categoryId: plan.categoryId,
      accountId: plan.accountId,
      installmentPlanId: plan.id,
      description: `${plan.description} (${index + 1}/${plan.months})`,
      amount: amounts[index] ?? 0,
      currency: plan.currency,
      date: installmentDate,
      installmentNumber: index + 1,
      source: "installment",
    });
  }

  if (rows.length > 0) {
    await db.expense.createMany({
      data: rows,
    });
  }
}

export const installmentPlanRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx.user);
    return db.installmentPlan.findMany({
      where: { userId },
      include: {
        account: {
          select: {
            id: true,
            name: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        expenses: {
          select: {
            id: true,
            amount: true,
            currency: true,
            date: true,
            installmentNumber: true,
          },
          orderBy: {
            installmentNumber: "asc",
          },
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
  }),

  create: protectedProcedure
    .input(installmentPlanInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      await assertOwnedCreditAccountAndCategory(userId, input);

      const plan = await db.installmentPlan.create({
        data: {
          userId,
          accountId: input.accountId,
          categoryId: input.categoryId,
          description: input.description,
          totalAmount: input.totalAmount,
          currency: input.currency,
          months: input.months,
          interestRate: input.interestRate ?? 0,
          startDate: input.startDate,
          status: input.status ?? "active",
        },
      });

      if (plan.status === "active") {
        await recreateInstallmentExpenses(userId, plan);
      }

      return db.installmentPlan.findUniqueOrThrow({
        where: { id: plan.id },
        include: {
          account: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          expenses: {
            select: {
              id: true,
              amount: true,
              currency: true,
              date: true,
              installmentNumber: true,
            },
            orderBy: { installmentNumber: "asc" },
          },
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: idSchema,
        data: installmentPlanInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      await assertOwnedCreditAccountAndCategory(userId, input.data);

      const updated = await db.installmentPlan.updateMany({
        where: {
          id: input.id,
          userId,
        },
        data: {
          accountId: input.data.accountId,
          categoryId: input.data.categoryId,
          description: input.data.description,
          totalAmount: input.data.totalAmount,
          currency: input.data.currency,
          months: input.data.months,
          interestRate: input.data.interestRate ?? 0,
          startDate: input.data.startDate,
          status: input.data.status ?? "active",
        },
      });

      if (updated.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Installment plan not found" });
      }

      const plan = await db.installmentPlan.findUniqueOrThrow({
        where: { id: input.id },
      });

      if (plan.status === "active") {
        await recreateInstallmentExpenses(userId, plan);
      } else {
        await db.expense.deleteMany({
          where: {
            userId,
            installmentPlanId: plan.id,
          },
        });
      }

      return db.installmentPlan.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          account: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          expenses: {
            select: {
              id: true,
              amount: true,
              currency: true,
              date: true,
              installmentNumber: true,
            },
            orderBy: { installmentNumber: "asc" },
          },
        },
      });
    }),

  cancel: protectedProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.user);
      const updated = await db.installmentPlan.updateMany({
        where: {
          id: input.id,
          userId,
        },
        data: {
          status: "cancelled",
        },
      });

      if (updated.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Installment plan not found" });
      }

      await db.expense.deleteMany({
        where: {
          userId,
          installmentPlanId: input.id,
        },
      });

      return { success: true };
    }),
});
