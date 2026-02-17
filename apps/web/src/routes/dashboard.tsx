import { useEffect, useMemo, useState } from "react";
import { createRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import { protectedRoute } from "./protected";
import { formatCurrencyByLanguage, formatDateByLanguage } from "../utils/locale";
import { trpc } from "../utils/trpc";
import { PageShell, PageHeader, Section } from "../components/layout/page";
import { Alert } from "../components/ui/alert";

type DashboardCategoryRow = {
  categoryId: string;
  categoryName: string;
  planned: { MXN: number; USD: number };
  actual: { MXN: number; USD: number };
  variance: { MXN: number; USD: number };
  isIncome: boolean;
};

type DashboardExpenseItem = {
  categoryId: string;
  amount: number;
  currency: "MXN" | "USD";
  amountInBudgetCurrency: number | null;
  conversionStatus: "none" | "estimated" | "confirmed";
  category: { name: string };
};

function isIncomeCategory(categoryName: string): boolean {
  return /income|salary|payroll|nomina|n[óo]mina|sueldo/i.test(categoryName);
}

export const dashboardRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/",
  component: DashboardPage,
});

function DashboardPage() {
  const { t, i18n } = useTranslation();

  const search = new URLSearchParams(window.location.search);
  const initialBudgetId = search.get("budgetId") ?? "";
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>(initialBudgetId);

  const budgetsQuery = trpc.budget.list.useQuery(undefined, { retry: false });
  const defaultBudgetQuery = trpc.budget.getDefault.useQuery(undefined, { retry: false });

  useEffect(() => {
    if (selectedBudgetId) return;
    if (defaultBudgetQuery.data?.id) {
      setSelectedBudgetId(defaultBudgetQuery.data.id);
    }
  }, [defaultBudgetQuery.data?.id, selectedBudgetId]);

  const budgetId = selectedBudgetId || defaultBudgetQuery.data?.id || null;
  const activeBudget = useMemo(() => {
    if (!budgetId) return null;
    return (budgetsQuery.data ?? []).find((budget) => budget.id === budgetId) ?? null;
  }, [budgetId, budgetsQuery.data]);

  const plannedQuery = trpc.budget.getPlannedByCategory.useQuery(
    { budgetId: budgetId ?? "" },
    { enabled: Boolean(budgetId), retry: false },
  );
  const expenseQuery = trpc.expense.list.useQuery(
    { budgetId: budgetId ?? undefined },
    { enabled: Boolean(budgetId), retry: false },
  );

  const activeError =
    budgetsQuery.error ??
    defaultBudgetQuery.error ??
    plannedQuery.error ??
    expenseQuery.error;
  const isLoading =
    budgetsQuery.isLoading ||
    defaultBudgetQuery.isLoading ||
    plannedQuery.isLoading ||
    expenseQuery.isLoading;
  const expenses = (expenseQuery.data ?? []) as DashboardExpenseItem[];

  const rows = useMemo<DashboardCategoryRow[]>(() => {
    const map = new Map<string, DashboardCategoryRow>();
    for (const category of plannedQuery.data?.categories ?? []) {
      map.set(category.categoryId, {
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        planned: {
          MXN: category.planned.MXN,
          USD: category.planned.USD,
        },
        actual: { MXN: 0, USD: 0 },
        variance: { MXN: 0, USD: 0 },
        isIncome: isIncomeCategory(category.categoryName),
      });
    }

    for (const expense of expenses) {
      const current = map.get(expense.categoryId) ?? {
        categoryId: expense.categoryId,
        categoryName: expense.category.name,
        planned: { MXN: 0, USD: 0 },
        actual: { MXN: 0, USD: 0 },
        variance: { MXN: 0, USD: 0 },
        isIncome: isIncomeCategory(expense.category.name),
      };

      current.actual[expense.currency] += expense.amount;
      map.set(expense.categoryId, current);
    }

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        variance: {
          MXN: item.actual.MXN - item.planned.MXN,
          USD: item.actual.USD - item.planned.USD,
        },
      }))
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  }, [expenses, plannedQuery.data?.categories]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        if (row.isIncome) {
          acc.plannedIncome.MXN += row.planned.MXN;
          acc.plannedIncome.USD += row.planned.USD;
          acc.actualIncome.MXN += row.actual.MXN;
          acc.actualIncome.USD += row.actual.USD;
          return acc;
        }

        acc.plannedExpense.MXN += row.planned.MXN;
        acc.plannedExpense.USD += row.planned.USD;
        acc.actualExpense.MXN += row.actual.MXN;
        acc.actualExpense.USD += row.actual.USD;
        return acc;
      },
      {
        plannedIncome: { MXN: 0, USD: 0 },
        actualIncome: { MXN: 0, USD: 0 },
        plannedExpense: { MXN: 0, USD: 0 },
        actualExpense: { MXN: 0, USD: 0 },
      },
    );
  }, [rows]);

  const usage = useMemo(() => {
    if (!activeBudget) {
      return {
        used: 0,
        estimatedCount: 0,
        remaining: 0,
        usagePercent: 0,
      };
    }

    const used = expenses.reduce((acc, expense) => {
      return acc + (expense.amountInBudgetCurrency ?? 0);
    }, 0);

    const estimatedCount = expenses.filter(
      (expense) => expense.conversionStatus === "estimated",
    ).length;

    const remaining = activeBudget.budgetLimit - used;
    const usagePercent =
      activeBudget.budgetLimit > 0
        ? Math.min((used / activeBudget.budgetLimit) * 100, 999)
        : 0;

    return {
      used,
      estimatedCount,
      remaining,
      usagePercent,
    };
  }, [activeBudget, expenses]);

  const chartData = useMemo(
    () =>
      rows.map((row) => ({
        name: row.categoryName,
        plannedMXN: row.planned.MXN / 100,
        actualMXN: row.actual.MXN / 100,
      })),
    [rows],
  );

  if (isLoading)
    return (
      <PageShell>
        <p className="empty-text">{t("dashboard.loading")}</p>
      </PageShell>
    );
  if (activeError?.data?.code === "UNAUTHORIZED") return null;
  if (activeError)
    return (
      <PageShell>
        <p className="error-text">
          {t("dashboard.error", { message: activeError.message })}
        </p>
      </PageShell>
    );

  return (
    <PageShell>
      <PageHeader title={t("dashboard.title")} description={t("dashboard.description")} />

      {!budgetsQuery.data?.length ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          {t("dashboard.noBudgets")}
        </Alert>
      ) : null}

      <Section>
        <div className="inline-row">
          <label>
            {t("dashboard.fields.budget")}{" "}
            <select
              value={budgetId ?? ""}
              onChange={(event) => setSelectedBudgetId(event.target.value)}
            >
              {(budgetsQuery.data ?? []).map((budget) => (
                <option key={budget.id} value={budget.id}>
                  {budget.name}
                  {budget.isDefault ? ` (${t("budgets.defaultTag")})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        {activeBudget ? (
          <p className="muted mt-2">
            {formatDateByLanguage(activeBudget.startDate, i18n.language)} -{" "}
            {formatDateByLanguage(activeBudget.endDate, i18n.language)} ·{" "}
            {activeBudget.currency}
          </p>
        ) : null}
      </Section>

      {activeBudget ? (
        <Section>
          <h2>{t("dashboard.limitTitle")}</h2>
          <ul>
            <li>
              {t("dashboard.limit")}:{" "}
              {formatCurrencyByLanguage(
                activeBudget.budgetLimit,
                activeBudget.currency,
                i18n.language,
              )}
            </li>
            <li>
              {t("dashboard.used")}:{" "}
              {formatCurrencyByLanguage(usage.used, activeBudget.currency, i18n.language)}
            </li>
            <li>
              {t("dashboard.remaining")}:{" "}
              {formatCurrencyByLanguage(
                usage.remaining,
                activeBudget.currency,
                i18n.language,
              )}
            </li>
            <li>
              {t("dashboard.usagePercent", { value: usage.usagePercent.toFixed(1) })}
            </li>
          </ul>
          {usage.estimatedCount > 0 ? (
            <Alert className="mt-2 border-amber-200 bg-amber-50 text-amber-900">
              {t("dashboard.estimatedWarning", { count: usage.estimatedCount })}
            </Alert>
          ) : null}
        </Section>
      ) : null}

      <Section>
        <h2>{t("dashboard.overviewTitle")}</h2>
        <ul>
          <li>
            {t("dashboard.plannedIncome")}:{" "}
            {formatCurrencyByLanguage(totals.plannedIncome.MXN, "MXN", i18n.language)}
            {" / "}
            {formatCurrencyByLanguage(totals.plannedIncome.USD, "USD", i18n.language)}
          </li>
          <li>
            {t("dashboard.actualIncome")}:{" "}
            {formatCurrencyByLanguage(totals.actualIncome.MXN, "MXN", i18n.language)}
            {" / "}
            {formatCurrencyByLanguage(totals.actualIncome.USD, "USD", i18n.language)}
          </li>
          <li>
            {t("dashboard.plannedExpense")}:{" "}
            {formatCurrencyByLanguage(totals.plannedExpense.MXN, "MXN", i18n.language)}
            {" / "}
            {formatCurrencyByLanguage(totals.plannedExpense.USD, "USD", i18n.language)}
          </li>
          <li>
            {t("dashboard.actualExpense")}:{" "}
            {formatCurrencyByLanguage(totals.actualExpense.MXN, "MXN", i18n.language)}
            {" / "}
            {formatCurrencyByLanguage(totals.actualExpense.USD, "USD", i18n.language)}
          </li>
        </ul>
      </Section>

      <Section>
        <h2>{t("dashboard.chartTitle")}</h2>
        {!chartData.length ? (
          <p className="empty-text">{t("dashboard.empty")}</p>
        ) : (
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="plannedMXN"
                  fill="#2563eb"
                  name={t("dashboard.chartPlannedMXN")}
                />
                <Bar
                  dataKey="actualMXN"
                  fill="#dc2626"
                  name={t("dashboard.chartActualMXN")}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <Section>
        <h2>{t("dashboard.budgetVsActualTitle")}</h2>
        {!rows.length ? (
          <p className="empty-text">{t("dashboard.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b px-3 py-2 text-left">
                    {t("dashboard.table.category")}
                  </th>
                  <th className="border-b px-3 py-2 text-left">
                    {t("dashboard.table.plannedMXN")}
                  </th>
                  <th className="border-b px-3 py-2 text-left">
                    {t("dashboard.table.actualMXN")}
                  </th>
                  <th className="border-b px-3 py-2 text-left">
                    {t("dashboard.table.varianceMXN")}
                  </th>
                  <th className="border-b px-3 py-2 text-left">
                    {t("dashboard.table.plannedUSD")}
                  </th>
                  <th className="border-b px-3 py-2 text-left">
                    {t("dashboard.table.actualUSD")}
                  </th>
                  <th className="border-b px-3 py-2 text-left">
                    {t("dashboard.table.varianceUSD")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.categoryId}>
                    <td className="border-b px-3 py-2">{row.categoryName}</td>
                    <td className="border-b px-3 py-2">
                      {formatCurrencyByLanguage(row.planned.MXN, "MXN", i18n.language)}
                    </td>
                    <td className="border-b px-3 py-2">
                      {formatCurrencyByLanguage(row.actual.MXN, "MXN", i18n.language)}
                    </td>
                    <td className="border-b px-3 py-2">
                      {formatCurrencyByLanguage(row.variance.MXN, "MXN", i18n.language)}
                    </td>
                    <td className="border-b px-3 py-2">
                      {formatCurrencyByLanguage(row.planned.USD, "USD", i18n.language)}
                    </td>
                    <td className="border-b px-3 py-2">
                      {formatCurrencyByLanguage(row.actual.USD, "USD", i18n.language)}
                    </td>
                    <td className="border-b px-3 py-2">
                      {formatCurrencyByLanguage(row.variance.USD, "USD", i18n.language)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </PageShell>
  );
}
