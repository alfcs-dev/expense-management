import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PrismaClient,
  type AccountType,
  type Currency,
  type InstallmentPlanStatus,
  type RecurringFrequency,
} from "@prisma/client";

type BudgetCsvRow = {
  section: string;
  name: string;
  monthlyAmountCents: number;
  biweeklyAmountCents: number | null;
  isAnnual: boolean;
  annualCostCents: number | null;
  notes: string | null;
  sourceAccountName: string | null;
  destinationAccountName: string | null;
  currency: Currency;
};

type DebtCsvRow = {
  concept: string;
  totalAmountCents: number;
  months: number;
  monthsPaid: number;
  monthlyPaymentCents: number;
  remainingAmountCents: number;
  cardName: string;
  currency: Currency;
};

type BudgetParsedCsv = {
  rows: BudgetCsvRow[];
  sections: string[];
};

type DebtParsedCsv = {
  rows: DebtCsvRow[];
  cards: string[];
};

type AccountCsvRow = {
  name: string;
  typeLabel: string | null;
  referenceCode: string | null;
  accountOrCard: string | null;
  clabe: string | null;
  type: AccountType;
  currency: Currency;
  institution: string | null;
};

type AccountParsedCsv = {
  rows: AccountCsvRow[];
};

type SeedAccount = {
  name: string;
  type: AccountType;
  currency: Currency;
  institution: string | null;
  clabe: string | null;
  referenceCode: string | null;
  accountOrCard: string | null;
};

const prisma = new PrismaClient();

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const defaultBudgetCsvPath = path.resolve(
  currentDir,
  "../../.planning/docs/Estimated expenses Mexico - September.csv",
);
const defaultDebtCsvPath = path.resolve(
  currentDir,
  "../../.planning/docs/Estimated expenses Mexico - Deuda.csv",
);
const defaultAccountsCsvPath = path.resolve(
  currentDir,
  "../../.planning/docs/Estimated expenses Mexico - Cuentas.csv",
);

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    apply: args.has("--apply"),
    preview: args.has("--preview") || !args.has("--apply"),
  };
}

function normalizeCell(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalizeAccountName(value: string | undefined): string | null {
  const normalized = normalizeCell(value);
  if (!normalized) return null;
  return normalized.replace(/\s+/g, " ");
}

function toAccountKey(value: string): string {
  return value.toLowerCase();
}

function normalizeDigits(value: string | undefined): string | null {
  const normalized = normalizeCell(value).replace(/\D/g, "");
  return normalized || null;
}

function parseMoneyToCents(raw: string | undefined): number | null {
  const value = normalizeCell(raw);
  if (!value) return null;
  const normalized = value.replace(/[$,\s]/g, "");
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function parseInteger(raw: string | undefined): number | null {
  const value = normalizeCell(raw);
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function parseBoolean(raw: string | undefined): boolean {
  return normalizeCell(raw).toUpperCase() === "TRUE";
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function isBudgetSectionRow(cells: string[]): boolean {
  const first = normalizeCell(cells[0]);
  if (!first) return false;
  if (first === "Nombre" || first === "Total") return false;
  const rest = cells.slice(1, 10).every((cell) => normalizeCell(cell) === "");
  return rest;
}

function parseBudgetCsv(content: string): BudgetParsedCsv {
  const lines = content.split(/\r?\n/).filter((line) => line.length > 0);
  const sections: string[] = [];
  const rows: BudgetCsvRow[] = [];
  let currentSection = "General";
  let inDataTable = false;

  for (const line of lines) {
    const cells = parseCsvLine(line);
    const name = normalizeCell(cells[0]);

    if (!name && inDataTable) {
      continue;
    }

    if (isBudgetSectionRow(cells)) {
      currentSection = name;
      sections.push(currentSection);
      inDataTable = false;
      continue;
    }

    if (name === "Nombre") {
      inDataTable = true;
      continue;
    }

    if (!inDataTable || !name || name === "Total") {
      continue;
    }

    const monthlyAmountCents =
      parseMoneyToCents(cells[5]) ?? parseMoneyToCents(cells[1]) ?? 0;
    const biweeklyAmountCents = parseMoneyToCents(cells[2]);
    const annualCostCents = parseMoneyToCents(cells[4]);
    const isAnnual = parseBoolean(cells[3]);

    rows.push({
      section: currentSection,
      name,
      monthlyAmountCents,
      biweeklyAmountCents,
      isAnnual,
      annualCostCents,
      notes: normalizeCell(cells[6]) || null,
      sourceAccountName: normalizeAccountName(cells[7]),
      destinationAccountName: normalizeAccountName(cells[8]),
      currency: "MXN",
    });
  }

  return { rows, sections };
}

function parseDebtCsv(content: string): DebtParsedCsv {
  const lines = content.split(/\r?\n/).filter((line) => line.length > 0);
  const rows: DebtCsvRow[] = [];
  const cards = new Set<string>();
  let inDataTable = false;

  for (const line of lines) {
    const cells = parseCsvLine(line);
    const first = normalizeCell(cells[0]);

    if (first === "Concepto") {
      inDataTable = true;
      continue;
    }

    if (!inDataTable) {
      continue;
    }

    if (!first) {
      continue;
    }

    if (first.startsWith("Total")) {
      break;
    }

    const totalAmountCents = parseMoneyToCents(cells[1]) ?? 0;
    const months = parseInteger(cells[2]) ?? 0;
    const monthsPaid = parseInteger(cells[3]) ?? 0;
    const monthlyPaymentCents = parseMoneyToCents(cells[4]) ?? 0;
    const remainingAmountCents = parseMoneyToCents(cells[5]) ?? 0;
    const cardName = normalizeAccountName(cells[6]);

    if (!cardName) {
      continue;
    }

    // Ignore summary/placeholder rows with no debt footprint.
    if (
      totalAmountCents === 0 &&
      monthlyPaymentCents === 0 &&
      remainingAmountCents === 0
    ) {
      continue;
    }

    rows.push({
      concept: first,
      totalAmountCents,
      months: Math.max(1, months),
      monthsPaid: Math.max(0, monthsPaid),
      monthlyPaymentCents,
      remainingAmountCents,
      cardName,
      currency: "MXN",
    });
    cards.add(cardName);
  }

  return { rows, cards: Array.from(cards) };
}

function parseAccountTypeLabel(
  typeLabel: string | null,
  accountName: string,
): AccountType {
  const value = (typeLabel ?? "").toLowerCase();
  if (
    value.includes("credito") ||
    value.includes("departamental")
  ) {
    return "credit";
  }
  if (value.includes("inversion")) {
    return "investment";
  }
  if (value.includes("ahorro") || value.includes("visible")) {
    return "debit";
  }
  return inferAccountType(accountName);
}

function parseAccountCsv(content: string): AccountParsedCsv {
  const lines = content.split(/\r?\n/).filter((line) => line.length > 0);
  const rows: AccountCsvRow[] = [];

  for (const line of lines) {
    const cells = parseCsvLine(line);
    const first = normalizeCell(cells[0]);

    if (!first || first === "Nombre cuenta") {
      continue;
    }

    const normalizedName = normalizeAccountName(cells[0]);
    if (!normalizedName) {
      continue;
    }

    const typeLabel = normalizeCell(cells[1]) || null;
    const referenceCode = normalizeCell(cells[2]) || null;
    const accountOrCard = normalizeDigits(cells[3]);
    const clabe = normalizeDigits(cells[4]);
    const institution = normalizedName.split(" ")[0] || null;

    rows.push({
      name: normalizedName,
      typeLabel,
      referenceCode,
      accountOrCard,
      clabe,
      type: parseAccountTypeLabel(typeLabel, normalizedName),
      currency: "MXN",
      institution,
    });
  }

  return { rows };
}

function inferAccountType(accountName: string): AccountType {
  const value = accountName.toLowerCase();
  if (
    value.includes("inversion") ||
    value.includes("trading") ||
    value.includes("dolares")
  ) {
    return "investment";
  }
  if (
    value.includes("world elite") ||
    value.includes("2now") ||
    value.includes("stori") ||
    value.includes("amex") ||
    value.includes("credito") ||
    value.includes("liverpool") ||
    value.includes("palacio") ||
    value.includes("tarjeta")
  ) {
    return "credit";
  }
  if (value.includes("efectivo")) {
    return "cash";
  }
  return "debit";
}

function inferFrequency(row: BudgetCsvRow): RecurringFrequency {
  if (row.isAnnual && row.annualCostCents) {
    return "annual";
  }
  if (
    row.biweeklyAmountCents &&
    row.biweeklyAmountCents > 0 &&
    row.monthlyAmountCents > 0 &&
    Math.abs(row.biweeklyAmountCents * 2 - row.monthlyAmountCents) <= 100
  ) {
    return "biweekly";
  }
  return "monthly";
}

function inferInstallmentStatus(row: DebtCsvRow): InstallmentPlanStatus {
  if (row.remainingAmountCents <= 0 || row.monthsPaid >= row.months) {
    return "completed";
  }
  return "active";
}

function uniqueAccountNames(
  budgetRows: BudgetCsvRow[],
  debtRows: DebtCsvRow[],
): string[] {
  const set = new Set<string>();
  for (const row of budgetRows) {
    if (row.sourceAccountName) set.add(row.sourceAccountName);
    if (row.destinationAccountName) set.add(row.destinationAccountName);
  }
  for (const row of debtRows) {
    set.add(row.cardName);
  }
  return Array.from(set);
}

function buildSeedAccounts(
  budgetRows: BudgetCsvRow[],
  debtRows: DebtCsvRow[],
  accountRows: AccountCsvRow[],
): SeedAccount[] {
  const byKey = new Map<string, SeedAccount>();
  const merge = (name: string, incoming: Partial<SeedAccount>) => {
    const key = toAccountKey(name);
    const previous = byKey.get(key);
    const next: SeedAccount = {
      name: previous?.name ?? name,
      type: incoming.type ?? previous?.type ?? inferAccountType(name),
      currency: incoming.currency ?? previous?.currency ?? "MXN",
      institution: incoming.institution ?? previous?.institution ?? null,
      clabe: incoming.clabe ?? previous?.clabe ?? null,
      referenceCode: incoming.referenceCode ?? previous?.referenceCode ?? null,
      accountOrCard: incoming.accountOrCard ?? previous?.accountOrCard ?? null,
    };
    byKey.set(key, next);
  };

  for (const row of accountRows) {
    merge(row.name, {
      name: row.name,
      type: row.type,
      currency: row.currency,
      institution: row.institution,
      clabe: row.clabe,
      referenceCode: row.referenceCode,
      accountOrCard: row.accountOrCard,
    });
  }

  for (const accountName of uniqueAccountNames(budgetRows, debtRows)) {
    merge(accountName, {
      name: accountName,
      type: inferAccountType(accountName),
      currency: "MXN",
      institution: accountName.split(" ")[0] || null,
    });
  }

  const clabeCounts = new Map<string, number>();
  for (const account of byKey.values()) {
    if (!account.clabe) continue;
    clabeCounts.set(account.clabe, (clabeCounts.get(account.clabe) ?? 0) + 1);
  }
  for (const [key, account] of byKey.entries()) {
    if (!account.clabe) continue;
    if ((clabeCounts.get(account.clabe) ?? 0) > 1) {
      byKey.set(key, { ...account, clabe: null });
    }
  }

  return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function makeBar(value: number, max: number, width = 24): string {
  if (max <= 0) return "".padEnd(width, "-");
  const filled = Math.max(0, Math.min(width, Math.round((value / max) * width)));
  return `${"#".repeat(filled)}${"-".repeat(width - filled)}`;
}

function buildVisualization(budgetRows: BudgetCsvRow[], debtRows: DebtCsvRow[]): string {
  const sectionTotals = new Map<string, number>();
  for (const row of budgetRows) {
    sectionTotals.set(
      row.section,
      (sectionTotals.get(row.section) ?? 0) + row.monthlyAmountCents,
    );
  }

  const cardRemaining = new Map<string, number>();
  for (const row of debtRows) {
    cardRemaining.set(
      row.cardName,
      (cardRemaining.get(row.cardName) ?? 0) + row.remainingAmountCents,
    );
  }

  const sectionEntries = Array.from(sectionTotals.entries()).sort((a, b) => b[1] - a[1]);
  const cardEntries = Array.from(cardRemaining.entries()).sort((a, b) => b[1] - a[1]);
  const maxSection = sectionEntries[0]?.[1] ?? 0;
  const maxCard = cardEntries[0]?.[1] ?? 0;

  const budgetLines = sectionEntries.map(([name, amount]) => {
    const bar = makeBar(amount, maxSection);
    return `${name.padEnd(20)} | ${bar} | MXN ${formatMoney(amount)}`;
  });

  const debtLines = cardEntries.map(([name, amount]) => {
    const bar = makeBar(amount, maxCard);
    return `${name.padEnd(20)} | ${bar} | MXN ${formatMoney(amount)}`;
  });

  return [
    "BUDGET MONTHLY TOTAL BY SECTION",
    ...budgetLines,
    "",
    "DEBT REMAINING BY CARD",
    ...debtLines,
  ].join("\n");
}

async function applySeed(
  budgetRows: BudgetCsvRow[],
  debtRows: DebtCsvRow[],
  accountRows: AccountCsvRow[],
) {
  const seedUserEmail = process.env.SEED_USER_EMAIL ?? "seed@local.dev";
  const seedUserName = process.env.SEED_USER_NAME ?? "Seed User";

  const user = await prisma.user.upsert({
    where: { email: seedUserEmail },
    update: { name: seedUserName },
    create: {
      email: seedUserEmail,
      name: seedUserName,
      emailVerified: true,
    },
  });

  await prisma.expense.deleteMany({ where: { userId: user.id } });
  await prisma.installmentPlan.deleteMany({ where: { userId: user.id } });
  await prisma.recurringExpense.deleteMany({ where: { userId: user.id } });
  await prisma.category.deleteMany({ where: { userId: user.id } });
  await prisma.account.deleteMany({ where: { userId: user.id } });
  await prisma.budget.deleteMany({ where: { userId: user.id } });

  const seedAccounts = buildSeedAccounts(budgetRows, debtRows, accountRows);
  const accountByKey = new Map<string, string>();
  for (const account of seedAccounts) {
    const created = await prisma.account.create({
      data: {
        userId: user.id,
        name: account.name,
        type: account.type,
        currency: account.currency,
        clabe: account.clabe,
        institution: account.institution,
        balance: 0,
      },
    });
    accountByKey.set(toAccountKey(account.name), created.id);
  }

  const categoryByName = new Map<string, string>();
  const recurringCategories = Array.from(new Set(budgetRows.map((row) => row.section)));
  const allCategories = [...recurringCategories, "Deuda MSI"];

  for (const [index, categoryName] of allCategories.entries()) {
    const created = await prisma.category.create({
      data: {
        userId: user.id,
        name: categoryName,
        sortOrder: index,
      },
    });
    categoryByName.set(categoryName, created.id);
  }

  for (const row of budgetRows) {
    if (!row.sourceAccountName) continue;

    const sourceAccountId = accountByKey.get(toAccountKey(row.sourceAccountName));
    const categoryId = categoryByName.get(row.section);
    if (!sourceAccountId || !categoryId) continue;

    const destinationAccountId = row.destinationAccountName
      ? accountByKey.get(toAccountKey(row.destinationAccountName)) ?? null
      : null;

    await prisma.recurringExpense.create({
      data: {
        userId: user.id,
        categoryId,
        sourceAccountId,
        destAccountId: destinationAccountId,
        description: row.name,
        amount: row.monthlyAmountCents,
        currency: row.currency,
        frequency: inferFrequency(row),
        isAnnual: row.isAnnual,
        annualCost: row.annualCostCents,
        notes: row.notes,
      },
    });
  }

  const installmentCategoryId = categoryByName.get("Deuda MSI");
  if (!installmentCategoryId) {
    throw new Error("Installment category missing");
  }

  const defaultStartDate = process.env.SEED_DEBT_START_DATE
    ? new Date(process.env.SEED_DEBT_START_DATE)
    : new Date();

  for (const row of debtRows) {
    const accountId = accountByKey.get(toAccountKey(row.cardName));
    if (!accountId) continue;

    await prisma.installmentPlan.create({
      data: {
        userId: user.id,
        accountId,
        categoryId: installmentCategoryId,
        description: row.concept,
        totalAmount: row.totalAmountCents,
        currency: row.currency,
        months: row.months,
        interestRate: 0,
        startDate: defaultStartDate,
        status: inferInstallmentStatus(row),
      },
    });
  }

  return {
    userId: user.id,
    email: user.email,
    accountsCreated: accountByKey.size,
    categoriesCreated: categoryByName.size,
    recurringExpensesCreated: budgetRows.filter((row) => row.sourceAccountName).length,
    installmentPlansCreated: debtRows.length,
  };
}

function previewData(
  budgetCsvPath: string,
  debtCsvPath: string,
  accountsCsvPath: string,
  budgetParsed: BudgetParsedCsv,
  debtParsed: DebtParsedCsv,
  accountParsed: AccountParsedCsv,
) {
  const recurringBySection = new Map<string, number>();
  for (const row of budgetParsed.rows) {
    recurringBySection.set(
      row.section,
      (recurringBySection.get(row.section) ?? 0) + 1,
    );
  }

  const debtByCard = new Map<string, { plans: number; remainingCents: number }>();
  for (const row of debtParsed.rows) {
    const prev = debtByCard.get(row.cardName) ?? { plans: 0, remainingCents: 0 };
    debtByCard.set(row.cardName, {
      plans: prev.plans + 1,
      remainingCents: prev.remainingCents + row.remainingAmountCents,
    });
  }

  const preview = {
    budgetCsvPath,
    debtCsvPath,
    accountsCsvPath,
    recurringExpenses: {
      rowsParsed: budgetParsed.rows.length,
      sections: Array.from(recurringBySection.entries()).map(([name, count]) => ({
        name,
        recurringExpenses: count,
      })),
      totalMonthlyCents: budgetParsed.rows.reduce(
        (sum, row) => sum + row.monthlyAmountCents,
        0,
      ),
    },
    installmentDebt: {
      rowsParsed: debtParsed.rows.length,
      cards: Array.from(debtByCard.entries()).map(([name, data]) => ({
        name,
        plans: data.plans,
        remainingCents: data.remainingCents,
      })),
      totalRemainingCents: debtParsed.rows.reduce(
        (sum, row) => sum + row.remainingAmountCents,
        0,
      ),
      totalMonthlyDebtPaymentCents: debtParsed.rows.reduce(
        (sum, row) => sum + row.monthlyPaymentCents,
        0,
      ),
    },
    uniqueAccountsReferenced: uniqueAccountNames(budgetParsed.rows, debtParsed.rows).sort(),
    accountCatalog: {
      rowsParsed: accountParsed.rows.length,
      totalSeedAccounts: buildSeedAccounts(
        budgetParsed.rows,
        debtParsed.rows,
        accountParsed.rows,
      ).length,
      sampleAccounts: accountParsed.rows.slice(0, 8).map((row) => ({
        name: row.name,
        typeLabel: row.typeLabel,
        type: row.type,
        clabe: row.clabe,
        accountOrCard: row.accountOrCard,
        referenceCode: row.referenceCode,
      })),
    },
    sampleRecurringExpenses: budgetParsed.rows.slice(0, 6).map((row) => ({
      section: row.section,
      description: row.name,
      monthlyAmountCents: row.monthlyAmountCents,
      biweeklyAmountCents: row.biweeklyAmountCents,
      isAnnual: row.isAnnual,
      annualCostCents: row.annualCostCents,
      frequency: inferFrequency(row),
      sourceAccount: row.sourceAccountName,
      destinationAccount: row.destinationAccountName,
      notes: row.notes,
    })),
    sampleInstallmentPlans: debtParsed.rows.slice(0, 8).map((row) => ({
      description: row.concept,
      cardName: row.cardName,
      totalAmountCents: row.totalAmountCents,
      months: row.months,
      monthsPaid: row.monthsPaid,
      monthlyPaymentCents: row.monthlyPaymentCents,
      remainingAmountCents: row.remainingAmountCents,
      status: inferInstallmentStatus(row),
    })),
    visualization: buildVisualization(budgetParsed.rows, debtParsed.rows),
  };

  console.log(JSON.stringify(preview, null, 2));
}

async function main() {
  const args = parseArgs();
  const budgetCsvPath = process.env.SEED_BUDGET_CSV_PATH ?? process.env.SEED_CSV_PATH ?? defaultBudgetCsvPath;
  const debtCsvPath = process.env.SEED_DEBT_CSV_PATH ?? defaultDebtCsvPath;
  const accountsCsvPath = process.env.SEED_ACCOUNTS_CSV_PATH ?? defaultAccountsCsvPath;

  const budgetCsvContent = fs.readFileSync(budgetCsvPath, "utf8");
  const debtCsvContent = fs.readFileSync(debtCsvPath, "utf8");
  const accountsCsvContent = fs.readFileSync(accountsCsvPath, "utf8");

  const budgetParsed = parseBudgetCsv(budgetCsvContent);
  const debtParsed = parseDebtCsv(debtCsvContent);
  const accountParsed = parseAccountCsv(accountsCsvContent);

  if (args.preview) {
    previewData(
      budgetCsvPath,
      debtCsvPath,
      accountsCsvPath,
      budgetParsed,
      debtParsed,
      accountParsed,
    );
  }

  if (!args.apply) {
    return;
  }

  const result = await applySeed(
    budgetParsed.rows,
    debtParsed.rows,
    accountParsed.rows,
  );
  console.log("Seed applied:", JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
