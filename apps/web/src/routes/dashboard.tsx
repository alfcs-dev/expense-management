import { useEffect, useMemo, useState } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import { rootRoute } from "./__root";
import { formatCurrencyByLanguage } from "../utils/locale";
import { trpc } from "../utils/trpc";

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
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: DashboardPage,
});

function DashboardPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const today = new Date();
  const [month, setMonth] = useState<number>(today.getMonth() + 1);
  const [year, setYear] = useState<number>(today.getFullYear());
  const [budgetId, setBudgetId] = useState<string | null>(null);

  const budgetMutation = trpc.budget.getOrCreateForMonth.useMutation();
  const plannedQuery = trpc.budget.getPlannedByCategory.useQuery(
    { budgetId: budgetId ?? "" },
    { enabled: Boolean(budgetId), retry: false },
  );
  const expenseQuery = trpc.expense.list.useQuery(
    { budgetId: budgetId ?? undefined },
    { enabled: Boolean(budgetId), retry: false },
  );

  useEffect(() => {
    void budgetMutation
      .mutateAsync({ month, year })
      .then((budget) => setBudgetId(budget.id));
  }, [budgetMutation, month, year]);

  useEffect(() => {
    const unauthorized =
      budgetMutation.error?.data?.code === "UNAUTHORIZED" ||
      (!plannedQuery.isLoading && plannedQuery.error?.data?.code === "UNAUTHORIZED") ||
      (!expenseQuery.isLoading && expenseQuery.error?.data?.code === "UNAUTHORIZED");

    if (unauthorized) {
      navigate({ to: "/" });
    }
  }, [
    budgetMutation.error?.data?.code,
    expenseQuery.error?.data?.code,
    expenseQuery.isLoading,
    navigate,
    plannedQuery.error?.data?.code,
    plannedQuery.isLoading,
  ]);

  const activeError = plannedQuery.error ?? expenseQuery.error ?? budgetMutation.error;
  const isLoading = budgetMutation.isPending || plannedQuery.isLoading || expenseQuery.isLoading;

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

  if (isLoading) return <p>{t("dashboard.loading")}</p>;
  if (activeError?.data?.code === "UNAUTHORIZED") return null;
  if (activeError) return <p>{t("dashboard.error", { message: activeError.message })}</p>;

  return (
    <div>
      <h1>{t("dashboard.title")}</h1>
      <p>{t("dashboard.description")}</p>

      <p>
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
      </p>

      <h2>{t("dashboard.overviewTitle")}</h2>
      <ul>
        <li>
          {t("dashboard.plannedIncome")}:
          {" "}
          {formatCurrencyByLanguage(totals.plannedIncome.MXN, "MXN", i18n.language)}
          {" / "}
          {formatCurrencyByLanguage(totals.plannedIncome.USD, "USD", i18n.language)}
        </li>
        <li>
          {t("dashboard.actualIncome")}:
          {" "}
          {formatCurrencyByLanguage(totals.actualIncome.MXN, "MXN", i18n.language)}
          {" / "}
          {formatCurrencyByLanguage(totals.actualIncome.USD, "USD", i18n.language)}
        </li>
        <li>
          {t("dashboard.plannedExpense")}:
          {" "}
          {formatCurrencyByLanguage(totals.plannedExpense.MXN, "MXN", i18n.language)}
          {" / "}
          {formatCurrencyByLanguage(totals.plannedExpense.USD, "USD", i18n.language)}
        </li>
        <li>
          {t("dashboard.actualExpense")}:
          {" "}
          {formatCurrencyByLanguage(totals.actualExpense.MXN, "MXN", i18n.language)}
          {" / "}
          {formatCurrencyByLanguage(totals.actualExpense.USD, "USD", i18n.language)}
        </li>
      </ul>

      <h2>{t("dashboard.chartTitle")}</h2>
      {!chartData.length ? (
        <p>{t("dashboard.empty")}</p>
      ) : (
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="plannedMXN" fill="#2563eb" name={t("dashboard.chartPlannedMXN")} />
              <Bar dataKey="actualMXN" fill="#dc2626" name={t("dashboard.chartActualMXN")} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <h2>{t("dashboard.budgetVsActualTitle")}</h2>
      {!rows.length ? (
        <p>{t("dashboard.empty")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t("dashboard.table.category")}</th>
              <th>{t("dashboard.table.plannedMXN")}</th>
              <th>{t("dashboard.table.actualMXN")}</th>
              <th>{t("dashboard.table.varianceMXN")}</th>
              <th>{t("dashboard.table.plannedUSD")}</th>
              <th>{t("dashboard.table.actualUSD")}</th>
              <th>{t("dashboard.table.varianceUSD")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.categoryId}>
                <td>{row.categoryName}</td>
                <td>{formatCurrencyByLanguage(row.planned.MXN, "MXN", i18n.language)}</td>
                <td>{formatCurrencyByLanguage(row.actual.MXN, "MXN", i18n.language)}</td>
                <td>{formatCurrencyByLanguage(row.variance.MXN, "MXN", i18n.language)}</td>
                <td>{formatCurrencyByLanguage(row.planned.USD, "USD", i18n.language)}</td>
                <td>{formatCurrencyByLanguage(row.actual.USD, "USD", i18n.language)}</td>
                <td>{formatCurrencyByLanguage(row.variance.USD, "USD", i18n.language)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
