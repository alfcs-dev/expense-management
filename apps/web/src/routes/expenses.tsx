import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { rootRoute } from "./__root";
import { formatCurrencyByLanguage, formatDateByLanguage } from "../utils/locale";
import { trpc } from "../utils/trpc";
import { PageShell, PageHeader, Section } from "../components/layout/page";
import { Alert } from "../components/ui/alert";
import { Button } from "../components/ui/button";

type ExpenseFormValues = {
  categoryId: string;
  accountId: string;
  description: string;
  amount: string;
  currency: "MXN" | "USD";
  date: string;
};

type ExpenseListItem = {
  id: string;
  categoryId: string;
  accountId: string;
  description: string;
  amount: number;
  currency: "MXN" | "USD";
  date: Date | string;
  category: { name: string };
  account: { name: string };
};

const now = new Date();

const INITIAL_FORM: ExpenseFormValues = {
  categoryId: "",
  accountId: "",
  description: "",
  amount: "",
  currency: "MXN",
  date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
};

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

function parseDisplayToCents(value: string): number {
  const normalized = value.replace(/[$,\s]/g, "");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

function toDateInputValue(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const expensesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/expenses",
  component: ExpensesPage,
});

function ExpensesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const search = new URLSearchParams(window.location.search);
  const initialMonth = Number.parseInt(search.get("month") ?? "", 10);
  const initialYear = Number.parseInt(search.get("year") ?? "", 10);
  const [selectedMonth, setSelectedMonth] = useState<number>(
    Number.isFinite(initialMonth) && initialMonth >= 1 && initialMonth <= 12
      ? initialMonth
      : now.getMonth() + 1,
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    Number.isFinite(initialYear) && initialYear >= 2000 && initialYear <= 2100
      ? initialYear
      : now.getFullYear(),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseFormValues>(INITIAL_FORM);

  const budgetQuery = trpc.budget.getOrCreateForMonth.useQuery(
    { month: selectedMonth, year: selectedYear },
    { retry: false },
  );
  const activeBudgetId = budgetQuery.data?.id ?? null;

  const accountsQuery = trpc.account.list.useQuery(undefined, { retry: false });
  const categoriesQuery = trpc.category.list.useQuery(undefined, { retry: false });
  const expenseListQuery = trpc.expense.list.useQuery(
    { budgetId: activeBudgetId ?? undefined },
    {
      enabled: Boolean(activeBudgetId),
      retry: false,
    },
  );

  const createMutation = trpc.expense.create.useMutation({
    onSuccess: async () => {
      await utils.expense.list.invalidate();
      setForm(INITIAL_FORM);
    },
  });
  const updateMutation = trpc.expense.update.useMutation({
    onSuccess: async () => {
      await utils.expense.list.invalidate();
      setEditingId(null);
      setForm(INITIAL_FORM);
    },
  });
  const deleteMutation = trpc.expense.delete.useMutation({
    onSuccess: async () => {
      await utils.expense.list.invalidate();
    },
  });

  useEffect(() => {
    const unauthorized =
      (!budgetQuery.isLoading && budgetQuery.error?.data?.code === "UNAUTHORIZED") ||
      (!accountsQuery.isLoading && accountsQuery.error?.data?.code === "UNAUTHORIZED") ||
      (!categoriesQuery.isLoading && categoriesQuery.error?.data?.code === "UNAUTHORIZED") ||
      (!expenseListQuery.isLoading && expenseListQuery.error?.data?.code === "UNAUTHORIZED");

    if (unauthorized) {
      navigate({ to: "/" });
    }
  }, [
    accountsQuery.error?.data?.code,
    accountsQuery.isLoading,
    budgetQuery.error?.data?.code,
    budgetQuery.isLoading,
    categoriesQuery.error?.data?.code,
    categoriesQuery.isLoading,
    expenseListQuery.error?.data?.code,
    expenseListQuery.isLoading,
    navigate,
  ]);

  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;
  const activeError =
    budgetQuery.error ??
    accountsQuery.error ??
    categoriesQuery.error ??
    expenseListQuery.error ??
    createMutation.error ??
    updateMutation.error ??
    deleteMutation.error;

  const submitLabel = useMemo(() => {
    if (createMutation.isPending || updateMutation.isPending) {
      return t("expenses.saving");
    }

    return editingId ? t("expenses.update") : t("expenses.create");
  }, [createMutation.isPending, editingId, t, updateMutation.isPending]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeBudgetId) return;

    const payload = {
      budgetId: activeBudgetId,
      categoryId: form.categoryId,
      accountId: form.accountId,
      description: form.description.trim(),
      amount: parseDisplayToCents(form.amount),
      currency: form.currency,
      date: new Date(`${form.date}T12:00:00`),
    };

    if (editingId) {
      await updateMutation.mutateAsync({
        id: editingId,
        data: payload,
      });
      return;
    }

    await createMutation.mutateAsync(payload);
  };

  const onEdit = (expense: ExpenseListItem) => {
    setEditingId(expense.id);
    setForm({
      categoryId: expense.categoryId,
      accountId: expense.accountId,
      description: expense.description,
      amount: centsToDisplay(expense.amount),
      currency: expense.currency,
      date: toDateInputValue(new Date(expense.date)),
    });
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
  };

  const onDelete = async (id: string) => {
    if (!window.confirm(t("expenses.deleteConfirm"))) return;
    await deleteMutation.mutateAsync({ id });
  };

  if (budgetQuery.isLoading || accountsQuery.isLoading || categoriesQuery.isLoading) {
    return <PageShell><p className="empty-text">{t("expenses.loading")}</p></PageShell>;
  }

  if (accountsQuery.error?.data?.code === "UNAUTHORIZED") return null;
  if (categoriesQuery.error?.data?.code === "UNAUTHORIZED") return null;
  if (expenseListQuery.error?.data?.code === "UNAUTHORIZED") return null;

  const expenses = (expenseListQuery.data ?? []) as ExpenseListItem[];

  return (
    <PageShell>
      <PageHeader title={t("expenses.title")} description={t("expenses.description")} />

      <Section>
      <div className="inline-row">
        <label>
          {t("expenses.fields.month")}{" "}
          <input
            type="number"
            min={1}
            max={12}
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(Number(event.target.value))}
          />
        </label>{" "}
        <label>
          {t("expenses.fields.year")}{" "}
          <input
            type="number"
            min={2000}
            max={2100}
            value={selectedYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
          />
        </label>
      </div>

      <form className="section-stack" onSubmit={onSubmit}>
        <p>
          <label>
            {t("expenses.fields.description")}{" "}
            <input
              type="text"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              required
            />
          </label>
        </p>

        <p>
          <label>
            {t("expenses.fields.category")}{" "}
            <select
              value={form.categoryId}
              onChange={(event) =>
                setForm((current) => ({ ...current, categoryId: event.target.value }))
              }
              required
            >
              <option value="">{t("expenses.placeholders.selectCategory")}</option>
              {(categoriesQuery.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </p>

        <p>
          <label>
            {t("expenses.fields.account")}{" "}
            <select
              value={form.accountId}
              onChange={(event) =>
                setForm((current) => ({ ...current, accountId: event.target.value }))
              }
              required
            >
              <option value="">{t("expenses.placeholders.selectAccount")}</option>
              {(accountsQuery.data ?? []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        </p>

        <p>
          <label>
            {t("expenses.fields.amount")}{" "}
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(event) =>
                setForm((current) => ({ ...current, amount: event.target.value }))
              }
              required
            />
          </label>
        </p>

        <p>
          <label>
            {t("expenses.fields.currency")}{" "}
            <select
              value={form.currency}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  currency: event.target.value as "MXN" | "USD",
                }))
              }
            >
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>
          </label>
        </p>

        <p>
          <label>
            {t("expenses.fields.date")}{" "}
            <input
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm((current) => ({ ...current, date: event.target.value }))
              }
              required
            />
          </label>
        </p>

        <div className="form-actions">
          <Button type="submit" disabled={isSubmitting}>
            {submitLabel}
          </Button>{" "}
          {editingId ? (
            <Button type="button" variant="secondary" onClick={onCancelEdit}>
              {t("expenses.cancelEdit")}
            </Button>
          ) : null}
        </div>
      </form>
      </Section>

      {activeError ? <Alert className="border-red-200 bg-red-50 text-red-700">{t("expenses.error", { message: activeError.message })}</Alert> : null}

      <Section>
      <h2>{t("expenses.listTitle")}</h2>
      {expenseListQuery.isLoading ? (
        <p className="empty-text">{t("expenses.loadingList")}</p>
      ) : expenses.length === 0 ? (
        <p className="empty-text">{t("expenses.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {expenses.map((expense) => (
            <li key={expense.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <strong>{expense.description}</strong> -{" "}
              {formatCurrencyByLanguage(
                expense.amount,
                expense.currency as "MXN" | "USD",
                i18n.language,
              )} -{" "}
              {expense.category.name} - {expense.account.name} -{" "}
              {formatDateByLanguage(expense.date, i18n.language)}{" "}
              <Button size="sm" type="button" variant="secondary" onClick={() => onEdit(expense)}>
                {t("expenses.edit")}
              </Button>{" "}
              <Button size="sm" type="button" variant="danger" onClick={() => onDelete(expense.id)}>
                {t("expenses.delete")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      </Section>
    </PageShell>
  );
}
