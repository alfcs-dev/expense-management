import { useMemo, useState } from "react";
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
import { formatCurrencyByLanguage } from "../utils/locale";
import { trpc } from "../utils/trpc";
import { PageShell, PageHeader, Section } from "../components/layout/page";

type DashboardCategoryRow = {
  categoryId: string;
  categoryName: string;
  planned: { MXN: number; USD: number };
  actual: { MXN: number; USD: number };
  variance: { MXN: number; USD: number };
  isIncome: boolean;
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

  const today = new Date();
  const search = new URLSearchParams(window.location.search);
  const initialMonth = Number.parseInt(search.get("month") ?? "", 10);
  const initialYear = Number.parseInt(search.get("year") ?? "", 10);
  const [month, setMonth] = useState<number>(
    Number.isFinite(initialMonth) && initialMonth >= 1 && initialMonth <= 12
      ? initialMonth
      : today.getMonth() + 1,
  );
  const [year, setYear] = useState<number>(
    Number.isFinite(initialYear) && initialYear >= 2000 && initialYear <= 2100
      ? initialYear
      : today.getFullYear(),
  );
  const budgetQuery = trpc.budget.getOrCreateForMonth.useQuery(
    { month, year },
    { retry: false },
  );
  const budgetId = budgetQuery.data?.id ?? null;
  const plannedQuery = trpc.budget.getPlannedByCategory.useQuery(
    { budgetId: budgetId ?? "" },
    { enabled: Boolean(budgetId), retry: false },
  );
  const expenseQuery = trpc.expense.list.useQuery(
    { budgetId: budgetId ?? undefined },
    { enabled: Boolean(budgetId), retry: false },
  );

  const activeError = budgetQuery.error ?? plannedQuery.error ?? expenseQuery.error;
  const isLoading =
    budgetQuery.isLoading || plannedQuery.isLoading || expenseQuery.isLoading;

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

    for (const expense of expenseQuery.data ?? []) {
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
  }, [expenseQuery.data, plannedQuery.data?.categories]);

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

  const chartData = useMemo(
    () =>
      rows.map((row) => ({
        name: row.categoryName,
        plannedMXN: row.planned.MXN / 100,
        actualMXN: row.actual.MXN / 100,
        plannedUSD: row.planned.USD / 100,
        actualUSD: row.actual.USD / 100,
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

      <Section>
        <div className="inline-row">
          <label>
            {t("dashboard.fields.month")}{" "}
            <input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            />
          </label>{" "}
          <label>
            {t("dashboard.fields.year")}{" "}
            <input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            />
          </label>
        </div>
      </Section>

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
