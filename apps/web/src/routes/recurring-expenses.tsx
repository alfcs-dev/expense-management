import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { RECURRING_FREQUENCIES } from "@expense-management/shared";
import { useTranslation } from "react-i18next";
import { protectedRoute } from "./protected";
import { formatCurrencyByLanguage } from "../utils/locale";
import { trpc } from "../utils/trpc";
import { PageShell, PageHeader, Section } from "../components/layout/page";
import { Alert } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";

type RecurringExpenseFormValues = {
  budgetId: string;
  categoryId: string;
  sourceAccountId: string;
  destAccountId: string;
  description: string;
  amount: string;
  currency: "MXN" | "USD";
  frequency: (typeof RECURRING_FREQUENCIES)[number];
  isAnnual: boolean;
  annualCost: string;
  notes: string;
  isActive: boolean;
};

const INITIAL_FORM: RecurringExpenseFormValues = {
  budgetId: "",
  categoryId: "",
  sourceAccountId: "",
  destAccountId: "",
  description: "",
  amount: "",
  currency: "MXN",
  frequency: "monthly",
  isAnnual: false,
  annualCost: "",
  notes: "",
  isActive: true,
};

function centsToDisplay(value: number | null): string {
  if (!value) return "";
  return (value / 100).toFixed(2);
}

function parseDisplayToCents(value: string): number {
  const normalized = value.replace(/[$,\s]/g, "");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

export const recurringExpensesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/recurring-expenses",
  component: RecurringExpensesPage,
});

function RecurringExpensesPage() {
  const { t, i18n } = useTranslation();
  const utils = trpc.useUtils();

  const [form, setForm] = useState<RecurringExpenseFormValues>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const recurringQuery = trpc.recurringExpense.list.useQuery(undefined, { retry: false });
  const accountsQuery = trpc.account.list.useQuery(undefined, { retry: false });
  const categoriesQuery = trpc.category.list.useQuery(undefined, { retry: false });
  const budgetsQuery = trpc.budget.list.useQuery(undefined, { retry: false });
  const defaultBudgetQuery = trpc.budget.getDefault.useQuery(undefined, { retry: false });
  const defaultBudgetId = defaultBudgetQuery.data?.id ?? "";

  useEffect(() => {
    if (form.budgetId) return;
    if (!defaultBudgetId) return;

    setForm((current) => ({
      ...current,
      budgetId: defaultBudgetId,
    }));
  }, [defaultBudgetId, form.budgetId]);

  const createMutation = trpc.recurringExpense.create.useMutation({
    onSuccess: async () => {
      await utils.recurringExpense.list.invalidate();
      setForm((current) => ({
        ...INITIAL_FORM,
        budgetId: current.budgetId || defaultBudgetId,
      }));
      setIsFormOpen(false);
    },
  });
  const updateMutation = trpc.recurringExpense.update.useMutation({
    onSuccess: async () => {
      await utils.recurringExpense.list.invalidate();
      setForm((current) => ({
        ...INITIAL_FORM,
        budgetId: current.budgetId || defaultBudgetId,
      }));
      setEditingId(null);
      setIsFormOpen(false);
    },
  });
  const deleteMutation = trpc.recurringExpense.delete.useMutation({
    onSuccess: async () => {
      await utils.recurringExpense.list.invalidate();
    },
  });

  const isSubmitting =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const activeError =
    recurringQuery.error ??
    accountsQuery.error ??
    categoriesQuery.error ??
    budgetsQuery.error ??
    defaultBudgetQuery.error ??
    createMutation.error ??
    updateMutation.error ??
    deleteMutation.error;

  const submitLabel = useMemo(() => {
    if (createMutation.isPending || updateMutation.isPending) {
      return t("recurringExpenses.saving");
    }

    return editingId ? t("recurringExpenses.update") : t("recurringExpenses.create");
  }, [createMutation.isPending, editingId, t, updateMutation.isPending]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      budgetId: form.budgetId,
      categoryId: form.categoryId,
      sourceAccountId: form.sourceAccountId,
      destAccountId: form.destAccountId || undefined,
      description: form.description.trim(),
      amount: parseDisplayToCents(form.amount),
      currency: form.currency,
      frequency: form.frequency,
      isAnnual: form.isAnnual,
      annualCost: form.isAnnual ? parseDisplayToCents(form.annualCost) : undefined,
      notes: form.notes.trim() || undefined,
      isActive: form.isActive,
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

  const onEdit = (item: NonNullable<typeof recurringQuery.data>[number]) => {
    setEditingId(item.id);
    setForm({
      budgetId: item.budgetId,
      categoryId: item.categoryId,
      sourceAccountId: item.sourceAccountId,
      destAccountId: item.destAccountId ?? "",
      description: item.description,
      amount: centsToDisplay(item.amount),
      currency: item.currency,
      frequency: item.frequency,
      isAnnual: item.isAnnual,
      annualCost: centsToDisplay(item.annualCost),
      notes: item.notes ?? "",
      isActive: item.isActive,
    });
    setIsFormOpen(true);
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setForm((current) => ({
      ...INITIAL_FORM,
      budgetId: current.budgetId || defaultBudgetQuery.data?.id || "",
    }));
    setIsFormOpen(false);
  };

  const onDelete = async (id: string) => {
    if (!window.confirm(t("recurringExpenses.deleteConfirm"))) return;
    await deleteMutation.mutateAsync({ id });
  };

  if (
    recurringQuery.isLoading ||
    accountsQuery.isLoading ||
    categoriesQuery.isLoading ||
    budgetsQuery.isLoading ||
    defaultBudgetQuery.isLoading
  ) {
    return (
      <PageShell>
        <p className="empty-text">{t("recurringExpenses.loading")}</p>
      </PageShell>
    );
  }

  if (recurringQuery.error?.data?.code === "UNAUTHORIZED") return null;
  if (accountsQuery.error?.data?.code === "UNAUTHORIZED") return null;
  if (categoriesQuery.error?.data?.code === "UNAUTHORIZED") return null;
  if (budgetsQuery.error?.data?.code === "UNAUTHORIZED") return null;
  if (defaultBudgetQuery.error?.data?.code === "UNAUTHORIZED") return null;

  return (
    <PageShell>
      <PageHeader
        title={t("recurringExpenses.title")}
        description={t("recurringExpenses.description")}
      />
      <Section>
        <div className="flex items-center justify-between gap-3">
          <p className="muted">{t("recurringExpenses.description")}</p>
          <Button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm((current) => ({
                ...INITIAL_FORM,
                budgetId: current.budgetId || defaultBudgetId,
              }));
              setIsFormOpen(true);
            }}
          >
            {t("recurringExpenses.create")}
          </Button>
        </div>

        <Sheet
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open && editingId) {
              setEditingId(null);
              setForm((current) => ({
                ...INITIAL_FORM,
                budgetId: current.budgetId || defaultBudgetId,
              }));
            }
          }}
        >
          <SheetContent side="right" className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>
                {editingId
                  ? t("recurringExpenses.update")
                  : t("recurringExpenses.create")}
              </SheetTitle>
              <SheetDescription>{t("recurringExpenses.description")}</SheetDescription>
            </SheetHeader>
            <form className="section-stack mt-6" onSubmit={onSubmit}>
              <p>
                <label>
                  {t("recurringExpenses.fields.budget")}{" "}
                  <select
                    value={form.budgetId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        budgetId: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">
                      {t("recurringExpenses.placeholders.selectBudget")}
                    </option>
                    {(budgetsQuery.data ?? []).map((budget) => (
                      <option key={budget.id} value={budget.id}>
                        {budget.name}
                        {budget.isDefault ? ` (${t("budgets.defaultTag")})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </p>

              <p>
                <label>
                  {t("recurringExpenses.fields.description")}{" "}
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
                  {t("recurringExpenses.fields.category")}{" "}
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
                      {t("recurringExpenses.placeholders.selectCategory")}
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
                  {t("recurringExpenses.fields.sourceAccount")}{" "}
                  <select
                    value={form.sourceAccountId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        sourceAccountId: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">
                      {t("recurringExpenses.placeholders.selectSourceAccount")}
                    </option>
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
                  {t("recurringExpenses.fields.destAccount")}{" "}
                  <select
                    value={form.destAccountId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        destAccountId: event.target.value,
                      }))
                    }
                  >
                    <option value="">{t("recurringExpenses.placeholders.none")}</option>
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
                  {t("recurringExpenses.fields.amount")}{" "}
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
                  {t("recurringExpenses.fields.currency")}{" "}
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
                  {t("recurringExpenses.fields.frequency")}{" "}
                  <select
                    value={form.frequency}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        frequency: event.target
                          .value as (typeof RECURRING_FREQUENCIES)[number],
                      }))
                    }
                  >
                    {RECURRING_FREQUENCIES.map((frequency) => (
                      <option key={frequency} value={frequency}>
                        {t(`recurringExpenses.frequency.${frequency}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </p>

              <p>
                <label>
                  <input
                    type="checkbox"
                    checked={form.isAnnual}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        isAnnual: event.target.checked,
                      }))
                    }
                  />{" "}
                  {t("recurringExpenses.fields.isAnnual")}
                </label>
              </p>

              {form.isAnnual ? (
                <p>
                  <label>
                    {t("recurringExpenses.fields.annualCost")}{" "}
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.annualCost}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          annualCost: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                </p>
              ) : null}

              <p>
                <label>
                  {t("recurringExpenses.fields.notes")}{" "}
                  <textarea
                    value={form.notes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, notes: event.target.value }))
                    }
                  />
                </label>
              </p>

              <p>
                <label>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                  />{" "}
                  {t("recurringExpenses.fields.isActive")}
                </label>
              </p>

              <div className="form-actions">
                <Button type="submit" disabled={isSubmitting}>
                  {submitLabel}
                </Button>{" "}
                {editingId ? (
                  <Button type="button" variant="secondary" onClick={onCancelEdit}>
                    {t("recurringExpenses.cancelEdit")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsFormOpen(false)}
                    disabled={isSubmitting}
                  >
                    {t("common.cancel")}
                  </Button>
                )}
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </Section>

      {activeError ? (
        <Alert className="border-red-200 bg-red-50 text-red-700">
          {t("recurringExpenses.error", { message: activeError.message })}
        </Alert>
      ) : null}

      <Section>
        <h2>{t("recurringExpenses.listTitle")}</h2>
        {!recurringQuery.data?.length ? (
          <p className="empty-text">{t("recurringExpenses.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {recurringQuery.data.map((item) => (
              <li
                key={item.id}
                className="rounded-md border border-slate-200 bg-slate-50 p-3"
              >
                <strong>{item.description}</strong> -{" "}
                {formatCurrencyByLanguage(
                  item.amount,
                  item.currency as "MXN" | "USD",
                  i18n.language,
                )}{" "}
                - {item.category.name} - {t("recurringExpenses.budgetLabel")}:{" "}
                {item.budget.name} - {t(`recurringExpenses.frequency.${item.frequency}`)}{" "}
                {!item.isActive ? `(${t("recurringExpenses.inactive")})` : ""}{" "}
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => onEdit(item)}
                >
                  {t("recurringExpenses.edit")}
                </Button>{" "}
                <Button
                  size="sm"
                  type="button"
                  variant="destructive"
                  onClick={() => onDelete(item.id)}
                >
                  {t("recurringExpenses.delete")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </PageShell>
  );
}
