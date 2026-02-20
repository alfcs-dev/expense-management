import { useMemo, useState } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { protectedRoute } from "./protected";
import { trpc } from "../utils/trpc";
import { formatCurrencyByLanguage, formatDateByLanguage } from "../utils/locale";
import { Button } from "@components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/Card";

export const dashboardRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/dashboard",
  component: DashboardPage,
});

function currentMonthInput(): string {
  return new Date().toISOString().slice(0, 7);
}

function DashboardPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonthInput());

  const summaryQuery = trpc.dashboard.summary.useQuery({ month });
  const summary = summaryQuery.data;

  const currency = useMemo(() => {
    return summary?.budgetPeriod?.currency ?? "MXN";
  }, [summary?.budgetPeriod?.currency]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl px-4 py-10">
      <div className="grid w-full gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <label className="flex items-center gap-2 text-sm">
            Month
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm"
            />
          </label>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account balances</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {summaryQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : null}
            {(summary?.accounts ?? []).map((account) => (
              <div key={account.id} className="rounded-xl border border-border p-3">
                <p className="text-sm font-medium">{account.name}</p>
                <p className="text-sm text-muted-foreground">{account.type}</p>
                <p className="text-sm">
                  {formatCurrencyByLanguage(
                    account.currentBalance,
                    account.currency,
                    i18n.language,
                  )}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Budget vs actual by category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!summary?.budgetPeriod ? (
              <p className="text-sm text-muted-foreground">
                No budget period found for this month. Create one in Budgets.
              </p>
            ) : null}
            {(summary?.budgetVsActual ?? []).map((item) => (
              <div key={item.categoryId} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{item.categoryName}</p>
                  <p className="text-sm text-muted-foreground">{item.categoryKind}</p>
                </div>
                <p className="text-sm">
                  Planned:{" "}
                  {formatCurrencyByLanguage(item.plannedAmount, currency, i18n.language)}
                </p>
                <p className="text-sm">
                  Actual:{" "}
                  {formatCurrencyByLanguage(item.actualAmount, currency, i18n.language)}
                </p>
                <p className="text-sm">
                  Variance:{" "}
                  {formatCurrencyByLanguage(item.varianceAmount, currency, i18n.language)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming / unpaid bills</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(summary?.billsDue ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pending bills in this month.
              </p>
            ) : null}
            {(summary?.billsDue ?? []).map((bill) => (
              <div key={bill.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{bill.bill.name}</p>
                  <p className="text-sm text-muted-foreground">{bill.status}</p>
                </div>
                <p className="text-sm">
                  Due: {formatDateByLanguage(bill.dueDate, i18n.language)}
                </p>
                <p className="text-sm">
                  Expected:{" "}
                  {formatCurrencyByLanguage(bill.expectedAmount, currency, i18n.language)}
                </p>
              </div>
            ))}
            <Button variant="outline" onClick={() => void navigate({ to: "/bills" })}>
              Open bills
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(summary?.recentTransactions ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No transactions in this month.
              </p>
            ) : null}
            {(summary?.recentTransactions ?? []).map((transaction) => (
              <div key={transaction.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{transaction.description}</p>
                  <p className="text-sm">
                    {formatCurrencyByLanguage(
                      transaction.amount,
                      transaction.account.currency,
                      i18n.language,
                    )}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {transaction.account.name} · {transaction.category.name} ·{" "}
                  {formatDateByLanguage(transaction.date, i18n.language)}
                </p>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => void navigate({ to: "/transactions" })}
            >
              Open transactions
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
