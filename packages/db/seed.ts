import { hashPassword } from "better-auth/crypto";
import {
  PrismaClient,
  type AccountType,
  type BillAmountType,
  type BudgetRuleType,
  type CategoryKind,
  type Currency,
  type IncomeSource,
  type InstallmentPlanStatus,
  type PlannedTransferStatus,
  type ProjectStatus,
  type SnapshotSource,
} from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    apply: args.has("--apply"),
    preview: args.has("--preview") || !args.has("--apply"),
  };
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

type SeedAccount = {
  name: string;
  type: AccountType;
  currency: Currency;
};

type SeedCategory = {
  name: string;
  kind: CategoryKind;
  parentName?: string;
};

const seedAccounts: SeedAccount[] = [
  { name: "Main Checking", type: "checking", currency: "MXN" },
  { name: "Cash Wallet", type: "cash", currency: "MXN" },
  { name: "HSBC World Elite", type: "credit_card", currency: "MXN" },
];

const seedCategories: SeedCategory[] = [
  { name: "Income", kind: "income" },
  { name: "Expenses", kind: "expense" },
  { name: "Food", kind: "expense", parentName: "Expenses" },
  { name: "Transport", kind: "expense", parentName: "Expenses" },
  { name: "Debt", kind: "debt" },
  { name: "Buffer", kind: "savings" },
  { name: "Transfers", kind: "transfer" },
];

async function applySeed() {
  const seedUserEmail = process.env.SEED_USER_EMAIL ?? "dev.seed@local.dev";
  const seedUserName = process.env.SEED_USER_NAME ?? "Dev Seed";
  const seedUserPassword = process.env.SEED_USER_PASSWORD ?? "DevSeed!234";

  const user = await prisma.user.upsert({
    where: { email: seedUserEmail },
    update: {
      name: seedUserName,
      emailVerified: true,
    },
    create: {
      email: seedUserEmail,
      name: seedUserName,
      emailVerified: true,
    },
  });

  const passwordHash = await hashPassword(seedUserPassword);

  await prisma.authAccount.upsert({
    where: {
      providerId_accountId: {
        providerId: "credential",
        accountId: user.id,
      },
    },
    update: {
      userId: user.id,
      password: passwordHash,
    },
    create: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: passwordHash,
    },
  });

  await prisma.statementPayment.deleteMany({ where: { userId: user.id } });
  await prisma.transfer.deleteMany({ where: { userId: user.id } });
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.plannedTransfer.deleteMany({ where: { userId: user.id } });
  await prisma.accountBalanceSnapshot.deleteMany({ where: { userId: user.id } });
  await prisma.bill.deleteMany({ where: { userId: user.id } });
  await prisma.installment.deleteMany({ where: { userId: user.id } });
  await prisma.installmentPlan.deleteMany({ where: { userId: user.id } });
  await prisma.creditCardStatement.deleteMany({ where: { userId: user.id } });
  await prisma.creditCardSettings.deleteMany({
    where: { account: { userId: user.id } },
  });
  await prisma.budget.deleteMany({ where: { userId: user.id } });
  await prisma.budgetRule.deleteMany({ where: { userId: user.id } });
  await prisma.incomePlanItem.deleteMany({ where: { userId: user.id } });
  await prisma.incomeEvent.deleteMany({ where: { userId: user.id } });
  await prisma.budgetPeriod.deleteMany({ where: { userId: user.id } });
  await prisma.project.deleteMany({ where: { userId: user.id } });
  await prisma.category.deleteMany({ where: { userId: user.id } });
  await prisma.accountTransferProfile.deleteMany({
    where: { account: { userId: user.id } },
  });
  await prisma.account.deleteMany({ where: { userId: user.id } });

  const accountByName = new Map<string, string>();
  for (const account of seedAccounts) {
    const created = await prisma.account.create({
      data: {
        userId: user.id,
        name: account.name,
        type: account.type,
        currency: account.currency,
      },
    });
    accountByName.set(account.name, created.id);
  }

  const checkingAccountId = accountByName.get("Main Checking");
  const creditAccountId = accountByName.get("HSBC World Elite");

  if (!checkingAccountId || !creditAccountId) {
    throw new Error("Required seed accounts were not created");
  }

  await prisma.accountTransferProfile.create({
    data: {
      accountId: checkingAccountId,
      clabe: "012180004180123456",
      beneficiaryName: "Main Checking",
      bankName: "BBVA",
      isProgrammable: true,
    },
  });

  await prisma.creditCardSettings.create({
    data: {
      accountId: creditAccountId,
      statementDay: 15,
      dueDay: 5,
      graceDays: 20,
    },
  });

  const categoryByName = new Map<string, string>();
  for (const category of seedCategories) {
    const parentId = category.parentName
      ? (categoryByName.get(category.parentName) ?? null)
      : null;
    const created = await prisma.category.create({
      data: {
        userId: user.id,
        name: category.name,
        kind: category.kind,
        parentId,
      },
    });
    categoryByName.set(category.name, created.id);
  }

  const foodCategoryId = categoryByName.get("Food");
  const debtCategoryId = categoryByName.get("Debt");
  const bufferCategoryId = categoryByName.get("Buffer");
  if (!foodCategoryId || !debtCategoryId || !bufferCategoryId) {
    throw new Error("Required seed categories were not created");
  }

  const now = new Date();
  const periodMonth = monthKey(now);
  const periodStart = startOfMonth(now);

  const budgetPeriod = await prisma.budgetPeriod.create({
    data: {
      userId: user.id,
      month: periodMonth,
      currency: "MXN",
      expectedIncomeAmount: 120_000_00,
      notes: "Seeded monthly plan",
    },
  });

  await prisma.incomePlanItem.create({
    data: {
      userId: user.id,
      budgetPeriodId: budgetPeriod.id,
      date: periodStart,
      source: "Salary plan",
      amount: 120_000_00,
      accountId: checkingAccountId,
      isRecurring: true,
    },
  });

  const incomeEvent = await prisma.incomeEvent.create({
    data: {
      userId: user.id,
      date: periodStart,
      amount: 120_000_00,
      accountId: checkingAccountId,
      budgetPeriodId: budgetPeriod.id,
      source: "salary" satisfies IncomeSource,
      notes: "Seed paycheck",
    },
  });

  const fixedRule = await prisma.budgetRule.create({
    data: {
      userId: user.id,
      name: "Food fixed",
      categoryId: foodCategoryId,
      ruleType: "fixed" satisfies BudgetRuleType,
      value: 18_000_00,
      applyOrder: 0,
    },
  });

  const percentRule = await prisma.budgetRule.create({
    data: {
      userId: user.id,
      name: "Buffer 10%",
      categoryId: bufferCategoryId,
      ruleType: "percent_of_income" satisfies BudgetRuleType,
      value: 1000,
      applyOrder: 1,
    },
  });

  await prisma.budget.createMany({
    data: [
      {
        userId: user.id,
        budgetPeriodId: budgetPeriod.id,
        categoryId: foodCategoryId,
        plannedAmount: 18_000_00,
        generatedFromRuleId: fixedRule.id,
      },
      {
        userId: user.id,
        budgetPeriodId: budgetPeriod.id,
        categoryId: bufferCategoryId,
        plannedAmount: 12_000_00,
        generatedFromRuleId: percentRule.id,
      },
    ],
  });

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name: "Vacation Fund",
      status: "active" satisfies ProjectStatus,
      startDate: periodStart,
    },
  });

  const installmentPlan = await prisma.installmentPlan.create({
    data: {
      userId: user.id,
      accountId: creditAccountId,
      name: "Laptop MSI",
      purchaseDate: periodStart,
      principalAmount: 24_000_00,
      installmentCountTotal: 12,
      installmentAmount: 2_000_00,
      status: "active" satisfies InstallmentPlanStatus,
      categoryId: debtCategoryId,
      projectId: project.id,
    },
  });

  const firstInstallment = await prisma.installment.create({
    data: {
      userId: user.id,
      planId: installmentPlan.id,
      installmentNumber: 1,
      dueDate: addDays(periodStart, 5),
      amount: 2_000_00,
    },
  });

  const statement = await prisma.creditCardStatement.create({
    data: {
      userId: user.id,
      accountId: creditAccountId,
      periodStart,
      periodEnd: addDays(periodStart, 30),
      closingDate: addDays(periodStart, 30),
      dueDate: addDays(periodStart, 45),
      statementBalance: 4_200_00,
      paymentsApplied: 0,
      status: "closed",
    },
  });

  await prisma.transaction.create({
    data: {
      userId: user.id,
      date: addDays(periodStart, 8),
      description: "Groceries card purchase",
      amount: 2_200_00,
      accountId: creditAccountId,
      categoryId: foodCategoryId,
      statementId: statement.id,
      installmentId: firstInstallment.id,
      notes: "Seed transaction",
    },
  });

  await prisma.transaction.create({
    data: {
      userId: user.id,
      date: periodStart,
      description: "Salary deposit",
      amount: 120_000_00,
      accountId: checkingAccountId,
      categoryId: categoryByName.get("Income")!,
      notes: "Seed income",
    },
  });

  const transferOutflowTxn = await prisma.transaction.create({
    data: {
      userId: user.id,
      date: addDays(periodStart, 12),
      description: "Card payment outflow",
      amount: -4_200_00,
      accountId: checkingAccountId,
      categoryId: categoryByName.get("Transfers")!,
      notes: "Seed transfer outflow",
    },
  });

  const transferInflowTxn = await prisma.transaction.create({
    data: {
      userId: user.id,
      date: addDays(periodStart, 12),
      description: "Card payment inflow",
      amount: 4_200_00,
      accountId: creditAccountId,
      categoryId: categoryByName.get("Transfers")!,
      notes: "Seed transfer inflow",
    },
  });

  const plannedTransfer = await prisma.plannedTransfer.create({
    data: {
      userId: user.id,
      plannedDate: addDays(periodStart, 12),
      fromAccountId: checkingAccountId,
      toAccountId: creditAccountId,
      amount: 4_200_00,
      status: "executed" satisfies PlannedTransferStatus,
      incomeEventId: incomeEvent.id,
      note: "Planned card payment",
    },
  });

  const transfer = await prisma.transfer.create({
    data: {
      userId: user.id,
      date: addDays(periodStart, 12),
      fromAccountId: checkingAccountId,
      toAccountId: creditAccountId,
      amount: 4_200_00,
      note: "Card payment",
      outflowTransactionId: transferOutflowTxn.id,
      inflowTransactionId: transferInflowTxn.id,
      plannedTransferId: plannedTransfer.id,
    },
  });

  await prisma.statementPayment.create({
    data: {
      userId: user.id,
      statementId: statement.id,
      transferId: transfer.id,
      amountApplied: 4_200_00,
    },
  });

  await prisma.bill.create({
    data: {
      userId: user.id,
      name: "Internet",
      categoryId: foodCategoryId,
      amountType: "fixed" satisfies BillAmountType,
      defaultAmount: 600_00,
      dueDay: 10,
      payingAccountId: checkingAccountId,
      fundingAccountId: null,
      isActive: true,
      notes: "Seed monthly bill",
    },
  });

  await prisma.accountBalanceSnapshot.createMany({
    data: [
      {
        userId: user.id,
        accountId: checkingAccountId,
        asOfDate: periodStart,
        balance: 115_800_00,
        source: "manual" satisfies SnapshotSource,
      },
      {
        userId: user.id,
        accountId: creditAccountId,
        asOfDate: periodStart,
        balance: -2_200_00,
        source: "manual" satisfies SnapshotSource,
      },
    ],
  });

  return {
    userId: user.id,
    email: user.email,
    password: seedUserPassword,
    accountsCreated: seedAccounts.length,
    categoriesCreated: seedCategories.length,
    transactionsCreated: 4,
    budgetsCreated: 2,
    statementsCreated: 1,
    installmentPlansCreated: 1,
  };
}

function previewData() {
  return {
    accounts: seedAccounts.map((a) => a.name),
    categories: seedCategories.map((c) => c.name),
    notes: [
      "Seed will create one monthly budget period with rules and generated budgets.",
      "Seed will create a credit statement with a linked payment transfer.",
      "Seed will create one installment plan with first installment linked to transaction.",
    ],
  };
}

async function main() {
  const { apply, preview } = parseArgs();

  if (preview) {
    console.log(JSON.stringify(previewData(), null, 2));
  }

  if (!apply) {
    return;
  }

  const result = await applySeed();
  console.log("Seed applied:", JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
