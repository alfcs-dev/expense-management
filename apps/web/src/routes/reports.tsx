import { useEffect, useMemo, useState } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import { rootRoute } from "./__root";
import { formatCurrencyByLanguage } from "../utils/locale";
import { trpc } from "../utils/trpc";

const now = new Date();

function monthLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reports",
  component: ReportsPage,
});

function ReportsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [fromYear, setFromYear] = useState(now.getFullYear());
  const [fromMonth, setFromMonth] = useState(Math.max(1, now.getMonth() - 2));
  const [toYear, setToYear] = useState(now.getFullYear());
  const [toMonth, setToMonth] = useState(now.getMonth() + 1);

  const rangeInput = useMemo(
    () => ({
      fromYear,
      fromMonth,
      toYear,
      toMonth,
    }),
    [fromMonth, fromYear, toMonth, toYear],
  );

  const monthlyTrendQuery = trpc.report.monthlyTrend.useQuery(rangeInput, { retry: false });
  const categoryBreakdownQuery = trpc.report.categoryBreakdown.useQuery(rangeInput, {
    retry: false,
  });
  const annualSummaryQuery = trpc.report.annualSummary.useQuery({ year: toYear }, {
    retry: false,
  });

  useEffect(() => {
    const unauthorized =
      (!monthlyTrendQuery.isLoading &&
        monthlyTrendQuery.error?.data?.code === "UNAUTHORIZED") ||
      (!categoryBreakdownQuery.isLoading &&
        categoryBreakdownQuery.error?.data?.code === "UNAUTHORIZED") ||
      (!annualSummaryQuery.isLoading &&
        annualSummaryQuery.error?.data?.code === "UNAUTHORIZED");
    if (unauthorized) {
      navigate({ to: "/" });
    }
  }, [
    annualSummaryQuery.error?.data?.code,
    annualSummaryQuery.isLoading,
    categoryBreakdownQuery.error?.data?.code,
    categoryBreakdownQuery.isLoading,
    monthlyTrendQuery.error?.data?.code,
    monthlyTrendQuery.isLoading,
    navigate,
  ]);

  const isLoading =
    monthlyTrendQuery.isLoading ||
    categoryBreakdownQuery.isLoading ||
    annualSummaryQuery.isLoading;

  const activeError =
    monthlyTrendQuery.error ?? categoryBreakdownQuery.error ?? annualSummaryQuery.error;

  if (isLoading) return <p>{t("reports.loading")}</p>;
  if (activeError?.data?.code === "UNAUTHORIZED") return null;
  if (activeError) return <p>{t("reports.error", { message: activeError.message })}</p>;

  const trendData = (monthlyTrendQuery.data ?? []).map((row) => ({
    label: monthLabel(row.year, row.month),
    expenseMXN: row.totalExpense.MXN / 100,
    incomeMXN: row.totalIncome.MXN / 100,
  }));

  const pieData = (categoryBreakdownQuery.data ?? []).map((row) => ({
    name: row.categoryName,
    value: row.total.MXN / 100,
  }));

  const summary = annualSummaryQuery.data;

  return (
    <div>
      <h1>{t("reports.title")}</h1>
      <p>{t("reports.description")}</p>

      <p>
        <label>
          {t("reports.fields.fromMonth")}{" "}
          <input
            type="number"
            min={1}
            max={12}
            value={fromMonth}
            onChange={(event) => setFromMonth(Number(event.target.value))}
          />
        </label>{" "}
        <label>
          {t("reports.fields.fromYear")}{" "}
          <input
            type="number"
            min={2000}
            max={2100}
            value={fromYear}
            onChange={(event) => setFromYear(Number(event.target.value))}
          />
        </label>{" "}
        <label>
          {t("reports.fields.toMonth")}{" "}
          <input
            type="number"
            min={1}
            max={12}
            value={toMonth}
            onChange={(event) => setToMonth(Number(event.target.value))}
          />
        </label>{" "}
        <label>
          {t("reports.fields.toYear")}{" "}
          <input
            type="number"
            min={2000}
            max={2100}
            value={toYear}
            onChange={(event) => setToYear(Number(event.target.value))}
          />
        </label>
      </p>

      <h2>{t("reports.annualSummaryTitle")}</h2>
      {summary ? (
        <ul>
          <li>
            {t("reports.incomeLabel")}:{" "}
            {formatCurrencyByLanguage(summary.totals.income.MXN, "MXN", i18n.language)}
          </li>
          <li>
            {t("reports.expenseLabel")}:{" "}
            {formatCurrencyByLanguage(summary.totals.expense.MXN, "MXN", i18n.language)}
          </li>
        </ul>
      ) : null}

      <h2>{t("reports.monthlyTrendTitle")}</h2>
      {!trendData.length ? (
        <p>{t("reports.empty")}</p>
      ) : (
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="incomeMXN" fill="#16a34a" name={t("reports.incomeLabel")} />
              <Bar dataKey="expenseMXN" fill="#dc2626" name={t("reports.expenseLabel")} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <h2>{t("reports.categoryBreakdownTitle")}</h2>
      {!pieData.length ? (
        <p>{t("reports.empty")}</p>
      ) : (
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100} label />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
