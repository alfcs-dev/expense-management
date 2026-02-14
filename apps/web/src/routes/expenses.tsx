import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { rootRoute } from "./__root";
import { trpc } from "../utils/trpc";

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

function formatCurrency(cents: number, currency: "MXN" | "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [activeBudgetId, setActiveBudgetId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseFormValues>(INITIAL_FORM);

  const accountsQuery = trpc.account.list.useQuery(undefined, { retry: false });
  const categoriesQuery = trpc.category.list.useQuery(undefined, { retry: false });
  const expenseListQuery = trpc.expense.list.useQuery(
    { budgetId: activeBudgetId ?? undefined },
    {
      enabled: Boolean(activeBudgetId),
      retry: false,
    },
  );

  const budgetMutation = trpc.budget.getOrCreateForMonth.useMutation();
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
    void budgetMutation
      .mutateAsync({
        month: selectedMonth,
        year: selectedYear,
      })
      .then((budget) => {
        setActiveBudgetId(budget.id);
      });
  }, [budgetMutation, selectedMonth, selectedYear]);

  useEffect(() => {
    const unauthorized =
      (!accountsQuery.isLoading && accountsQuery.error?.data?.code === "UNAUTHORIZED") ||
      (!categoriesQuery.isLoading && categoriesQuery.error?.data?.code === "UNAUTHORIZED") ||
      (!expenseListQuery.isLoading && expenseListQuery.error?.data?.code === "UNAUTHORIZED") ||
      budgetMutation.error?.data?.code === "UNAUTHORIZED";

    if (unauthorized) {
      navigate({ to: "/" });
    }
  }, [
    accountsQuery.error?.data?.code,
    accountsQuery.isLoading,
    budgetMutation.error?.data?.code,
    categoriesQuery.error?.data?.code,
    categoriesQuery.isLoading,
    expenseListQuery.error?.data?.code,
    expenseListQuery.isLoading,
    navigate,
  ]);

  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    budgetMutation.isPending;
  const activeError =
    accountsQuery.error ??
    categoriesQuery.error ??
    expenseListQuery.error ??
    budgetMutation.error ??
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

  if (accountsQuery.isLoading || categoriesQuery.isLoading || budgetMutation.isPending) {
    return <p>{t("expenses.loading")}</p>;
  }

  if (accountsQuery.error?.data?.code === "UNAUTHORIZED") return null;
  if (categoriesQuery.error?.data?.code === "UNAUTHORIZED") return null;
  if (expenseListQuery.error?.data?.code === "UNAUTHORIZED") return null;

  const expenses = (expenseListQuery.data ?? []) as ExpenseListItem[];

  return (
    <div>
      <h1>{t("expenses.title")}</h1>
      <p>{t("expenses.description")}</p>

      <p>
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
      </p>

      <form onSubmit={onSubmit}>
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

        <p>
          <button type="submit" disabled={isSubmitting}>
            {submitLabel}
          </button>{" "}
          {editingId ? (
            <button type="button" onClick={onCancelEdit}>
              {t("expenses.cancelEdit")}
            </button>
          ) : null}
        </p>
      </form>

      {activeError ? <p>{t("expenses.error", { message: activeError.message })}</p> : null}

      <h2>{t("expenses.listTitle")}</h2>
      {expenseListQuery.isLoading ? (
        <p>{t("expenses.loadingList")}</p>
      ) : expenses.length === 0 ? (
        <p>{t("expenses.empty")}</p>
      ) : (
        <ul>
          {expenses.map((expense) => (
            <li key={expense.id}>
              <strong>{expense.description}</strong> -{" "}
              {formatCurrency(expense.amount, expense.currency as "MXN" | "USD")} -{" "}
              {expense.category.name} - {expense.account.name} -{" "}
              {toDateInputValue(new Date(expense.date))}{" "}
              <button type="button" onClick={() => onEdit(expense)}>
                {t("expenses.edit")}
              </button>{" "}
              <button type="button" onClick={() => onDelete(expense.id)}>
                {t("expenses.delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
