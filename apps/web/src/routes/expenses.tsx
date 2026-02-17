import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { protectedRoute } from "./protected";
import { formatCurrencyByLanguage, formatDateByLanguage } from "../utils/locale";
import { trpc } from "../utils/trpc";
import { PageShell, PageHeader, Section } from "../components/layout/page";
import { Alert } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";

type ExpenseFormValues = {
  categoryId: string;
  accountId: string;
  description: string;
  amount: string;
  currency: "MXN" | "USD";
  amountInBudgetCurrency: string;
  date: string;
};

type ExpenseListItem = {
  id: string;
  categoryId: string;
  accountId: string;
  description: string;
  amount: number;
  currency: "MXN" | "USD";
  amountInBudgetCurrency: number | null;
  conversionStatus: "none" | "estimated" | "confirmed";
  date: Date | string;
  category: { name: string };
  account: { name: string };
  budget: { id: string; name: string; currency: "MXN" | "USD" };
};

const now = new Date();

const INITIAL_FORM: ExpenseFormValues = {
  categoryId: "",
  accountId: "",
  description: "",
  amount: "",
  currency: "MXN",
  amountInBudgetCurrency: "",
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
  getParentRoute: () => protectedRoute,
  path: "/expenses",
  component: ExpensesPage,
});

function ExpensesPage() {
  const { t, i18n } = useTranslation();
  const utils = trpc.useUtils();

  const search = new URLSearchParams(window.location.search);
  const initialBudgetId = search.get("budgetId") ?? "";

  const [selectedBudgetId, setSelectedBudgetId] = useState<string>(initialBudgetId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<ExpenseFormValues>(INITIAL_FORM);

  const budgetsQuery = trpc.budget.list.useQuery(undefined, { retry: false });
  const defaultBudgetQuery = trpc.budget.getDefault.useQuery(undefined, { retry: false });

  useEffect(() => {
    if (selectedBudgetId) return;
    if (defaultBudgetQuery.data?.id) {
      setSelectedBudgetId(defaultBudgetQuery.data.id);
    }
  }, [defaultBudgetQuery.data?.id, selectedBudgetId]);

  const activeBudgetId = selectedBudgetId || defaultBudgetQuery.data?.id || null;

  const activeBudget = useMemo(() => {
    if (!activeBudgetId) return null;
    return (
      (budgetsQuery.data ?? []).find((budget) => budget.id === activeBudgetId) ?? null
    );
  }, [activeBudgetId, budgetsQuery.data]);

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
      setIsFormOpen(false);
    },
  });
  const updateMutation = trpc.expense.update.useMutation({
    onSuccess: async () => {
      await utils.expense.list.invalidate();
      setEditingId(null);
      setForm(INITIAL_FORM);
      setIsFormOpen(false);
    },
  });
  const deleteMutation = trpc.expense.delete.useMutation({
    onSuccess: async () => {
      await utils.expense.list.invalidate();
    },
  });

  const activeError =
    budgetsQuery.error ??
    defaultBudgetQuery.error ??
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

  const showConversionInput =
    Boolean(activeBudget) && form.currency !== activeBudget?.currency;

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
      amountInBudgetCurrency: showConversionInput
        ? parseDisplayToCents(form.amountInBudgetCurrency)
        : undefined,
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
    setSelectedBudgetId(expense.budget.id);
    setForm({
      categoryId: expense.categoryId,
      accountId: expense.accountId,
      description: expense.description,
      amount: centsToDisplay(expense.amount),
      currency: expense.currency,
      amountInBudgetCurrency: expense.amountInBudgetCurrency
        ? centsToDisplay(expense.amountInBudgetCurrency)
        : "",
      date: toDateInputValue(new Date(expense.date)),
    });
    setIsFormOpen(true);
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setIsFormOpen(false);
  };

  const onDelete = async (id: string) => {
    if (!window.confirm(t("expenses.deleteConfirm"))) return;
    await deleteMutation.mutateAsync({ id });
  };

  if (
    budgetsQuery.isLoading ||
    defaultBudgetQuery.isLoading ||
    accountsQuery.isLoading ||
    categoriesQuery.isLoading
  ) {
    return (
      <PageShell>
        <p className="empty-text">{t("expenses.loading")}</p>
      </PageShell>
    );
  }

  if (accountsQuery.error?.data?.code === "UNAUTHORIZED") return null;
  if (categoriesQuery.error?.data?.code === "UNAUTHORIZED") return null;
  if (expenseListQuery.error?.data?.code === "UNAUTHORIZED") return null;

  const expenses = (expenseListQuery.data ?? []) as ExpenseListItem[];

  return (
    <PageShell>
      <PageHeader title={t("expenses.title")} description={t("expenses.description")} />

      {!budgetsQuery.data?.length ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          {t("expenses.noBudgets")}
        </Alert>
      ) : null}

      <Section>
        <div className="inline-row">
          <label>
            {t("expenses.fields.budget")}{" "}
            <select
              value={activeBudgetId ?? ""}
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
            {activeBudget.currency} ·{" "}
            {formatCurrencyByLanguage(
              activeBudget.budgetLimit,
              activeBudget.currency,
              i18n.language,
            )}
          </p>
        ) : null}
      </Section>

      {activeError ? (
        <Alert className="border-red-200 bg-red-50 text-red-700">
          {t("expenses.error", { message: activeError.message })}
        </Alert>
      ) : null}

      <Section>
        <div className="mt-4">
          <Dialog
            open={isFormOpen}
            onOpenChange={(open) => {
              setIsFormOpen(open);
              if (!open && editingId) {
                setEditingId(null);
                setForm(INITIAL_FORM);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                type="button"
                onClick={() => setIsFormOpen(true)}
                disabled={!activeBudgetId}
              >
                {editingId ? t("expenses.update") : t("expenses.create")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? t("expenses.update") : t("expenses.create")}
                </DialogTitle>
                <DialogDescription>{t("expenses.description")}</DialogDescription>
              </DialogHeader>
              <form className="section-stack" onSubmit={onSubmit}>
                <p>
                  <label>
                    {t("expenses.fields.description")}{" "}
                    <input
                      type="text"
                      value={form.description}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
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
                        setForm((current) => ({
                          ...current,
                          categoryId: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">
                        {t("expenses.placeholders.selectCategory")}
                      </option>
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
                        setForm((current) => ({
                          ...current,
                          accountId: event.target.value,
                        }))
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
                      min={0}
                      step="0.01"
                      value={form.amount}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          amount: event.target.value,
                        }))
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
                      required
                    >
                      <option value="MXN">MXN</option>
                      <option value="USD">USD</option>
                    </select>
                  </label>
                </p>

                {showConversionInput && activeBudget ? (
                  <>
                    <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                      {t("expenses.estimatedConversionWarning", {
                        currency: activeBudget.currency,
                      })}
                    </Alert>
                    <p>
                      <label>
                        {t("expenses.fields.amountInBudgetCurrency", {
                          currency: activeBudget.currency,
                        })}{" "}
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={form.amountInBudgetCurrency}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              amountInBudgetCurrency: event.target.value,
                            }))
                          }
                          placeholder={t("expenses.placeholders.amountInBudgetCurrency")}
                        />
                      </label>
                    </p>
                  </>
                ) : null}

                <p>
                  <label>
                    {t("expenses.fields.date")}{" "}
                    <input
                      type="date"
                      value={form.date}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          date: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                </p>

                <DialogFooter>
                  {editingId ? (
                    <Button type="button" variant="secondary" onClick={onCancelEdit}>
                      {t("expenses.cancelEdit")}
                    </Button>
                  ) : null}
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {submitLabel}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </Section>

      <Section>
        <h2>{t("expenses.listTitle")}</h2>

        {expenseListQuery.isLoading ? (
          <p className="empty-text">{t("expenses.loadingList")}</p>
        ) : !expenses.length ? (
          <p className="empty-text">{t("expenses.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {expenses.map((expense) => (
              <li
                key={expense.id}
                className="rounded-md border border-slate-200 bg-white p-3"
              >
                <div className="inline-row">
                  <strong>{expense.description}</strong>
                  <span className="muted">{expense.category.name}</span>
                </div>
                <div className="inline-row mt-1">
                  <span>
                    {formatCurrencyByLanguage(
                      expense.amount,
                      expense.currency,
                      i18n.language,
                    )}
                  </span>
                  <span className="muted">
                    · {formatDateByLanguage(expense.date, i18n.language)}
                  </span>
                </div>
                {expense.amountInBudgetCurrency && activeBudget ? (
                  <p className="muted mt-1">
                    {t("expenses.convertedAmount", {
                      amount: formatCurrencyByLanguage(
                        expense.amountInBudgetCurrency,
                        activeBudget.currency,
                        i18n.language,
                      ),
                    })}
                    {expense.conversionStatus === "estimated"
                      ? ` (${t("expenses.estimatedTag")})`
                      : ""}
                  </p>
                ) : null}
                <div className="inline-row mt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onEdit(expense)}
                  >
                    {t("expenses.edit")}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => onDelete(expense.id)}
                  >
                    {t("expenses.delete")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </PageShell>
  );
}
