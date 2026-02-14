import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { rootRoute } from "./__root";
import { formatCurrencyByLanguage, formatDateByLanguage } from "../utils/locale";
import { trpc } from "../utils/trpc";

type InstallmentFormValues = {
  accountId: string;
  categoryId: string;
  description: string;
  totalAmount: string;
  currency: "MXN" | "USD";
  months: string;
  interestRate: string;
  startDate: string;
  status: "active" | "completed" | "cancelled";
};

const now = new Date();

const INITIAL_FORM: InstallmentFormValues = {
  accountId: "",
  categoryId: "",
  description: "",
  totalAmount: "",
  currency: "MXN",
  months: "3",
  interestRate: "0",
  startDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
  status: "active",
};

function parseDisplayToCents(value: string): number {
  const normalized = value.replace(/[$,\s]/g, "");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

export const installmentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/installments",
  component: InstallmentsPage,
});

function InstallmentsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [form, setForm] = useState<InstallmentFormValues>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const planQuery = trpc.installmentPlan.list.useQuery(undefined, { retry: false });
  const accountsQuery = trpc.account.list.useQuery(undefined, { retry: false });
  const categoriesQuery = trpc.category.list.useQuery(undefined, { retry: false });

  const createMutation = trpc.installmentPlan.create.useMutation({
    onSuccess: async () => {
      await utils.installmentPlan.list.invalidate();
      await utils.expense.list.invalidate();
      setForm(INITIAL_FORM);
    },
  });
  const updateMutation = trpc.installmentPlan.update.useMutation({
    onSuccess: async () => {
      await utils.installmentPlan.list.invalidate();
      await utils.expense.list.invalidate();
      setEditingId(null);
      setForm(INITIAL_FORM);
    },
  });
  const cancelMutation = trpc.installmentPlan.cancel.useMutation({
    onSuccess: async () => {
      await utils.installmentPlan.list.invalidate();
      await utils.expense.list.invalidate();
    },
  });

  useEffect(() => {
    const unauthorized =
      (!planQuery.isLoading && planQuery.error?.data?.code === "UNAUTHORIZED") ||
      (!accountsQuery.isLoading && accountsQuery.error?.data?.code === "UNAUTHORIZED") ||
      (!categoriesQuery.isLoading && categoriesQuery.error?.data?.code === "UNAUTHORIZED");

    if (unauthorized) {
      navigate({ to: "/" });
    }
  }, [
    accountsQuery.error?.data?.code,
    accountsQuery.isLoading,
    categoriesQuery.error?.data?.code,
    categoriesQuery.isLoading,
    navigate,
    planQuery.error?.data?.code,
    planQuery.isLoading,
  ]);

  const isSubmitting =
    createMutation.isPending || updateMutation.isPending || cancelMutation.isPending;
  const activeError =
    planQuery.error ??
    accountsQuery.error ??
    categoriesQuery.error ??
    createMutation.error ??
    updateMutation.error ??
    cancelMutation.error;

  const submitLabel = useMemo(() => {
    if (createMutation.isPending || updateMutation.isPending) {
      return t("installments.saving");
    }
    return editingId ? t("installments.update") : t("installments.create");
  }, [createMutation.isPending, editingId, t, updateMutation.isPending]);

  const creditAccounts = (accountsQuery.data ?? []).filter((account) => account.type === "credit");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      accountId: form.accountId,
      categoryId: form.categoryId,
      description: form.description.trim(),
      totalAmount: parseDisplayToCents(form.totalAmount),
      currency: form.currency,
      months: Number(form.months),
      interestRate: Number(form.interestRate),
      startDate: new Date(`${form.startDate}T12:00:00`),
      status: form.status,
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

  const onEdit = (plan: NonNullable<typeof planQuery.data>[number]) => {
    setEditingId(plan.id);
    setForm({
      accountId: plan.accountId,
      categoryId: plan.categoryId,
      description: plan.description,
      totalAmount: (plan.totalAmount / 100).toFixed(2),
      currency: plan.currency,
      months: String(plan.months),
      interestRate: String(plan.interestRate),
      startDate: new Date(plan.startDate).toISOString().slice(0, 10),
      status: plan.status,
    });
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
  };

  const onCancelPlan = async (id: string) => {
    if (!window.confirm(t("installments.cancelConfirm"))) return;
    await cancelMutation.mutateAsync({ id });
  };

  if (planQuery.isLoading || accountsQuery.isLoading || categoriesQuery.isLoading) {
    return <p>{t("installments.loading")}</p>;
  }

  if (planQuery.error?.data?.code === "UNAUTHORIZED") return null;
  if (accountsQuery.error?.data?.code === "UNAUTHORIZED") return null;
  if (categoriesQuery.error?.data?.code === "UNAUTHORIZED") return null;

  return (
    <div>
      <h1>{t("installments.title")}</h1>
      <p>{t("installments.description")}</p>

      <form onSubmit={onSubmit}>
        <p>
          <label>
            {t("installments.fields.description")}{" "}
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
            {t("installments.fields.account")}{" "}
            <select
              value={form.accountId}
              onChange={(event) =>
                setForm((current) => ({ ...current, accountId: event.target.value }))
              }
              required
            >
              <option value="">{t("installments.placeholders.selectAccount")}</option>
              {creditAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        </p>

        <p>
          <label>
            {t("installments.fields.category")}{" "}
            <select
              value={form.categoryId}
              onChange={(event) =>
                setForm((current) => ({ ...current, categoryId: event.target.value }))
              }
              required
            >
              <option value="">{t("installments.placeholders.selectCategory")}</option>
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
            {t("installments.fields.totalAmount")}{" "}
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.totalAmount}
              onChange={(event) =>
                setForm((current) => ({ ...current, totalAmount: event.target.value }))
              }
              required
            />
          </label>
        </p>

        <p>
          <label>
            {t("installments.fields.currency")}{" "}
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
            {t("installments.fields.months")}{" "}
            <input
              type="number"
              min={1}
              max={120}
              value={form.months}
              onChange={(event) =>
                setForm((current) => ({ ...current, months: event.target.value }))
              }
              required
            />
          </label>
        </p>

        <p>
          <label>
            {t("installments.fields.interestRate")}{" "}
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.interestRate}
              onChange={(event) =>
                setForm((current) => ({ ...current, interestRate: event.target.value }))
              }
            />
          </label>
        </p>

        <p>
          <label>
            {t("installments.fields.startDate")}{" "}
            <input
              type="date"
              value={form.startDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, startDate: event.target.value }))
              }
              required
            />
          </label>
        </p>

        <p>
          <label>
            {t("installments.fields.status")}{" "}
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.value as "active" | "completed" | "cancelled",
                }))
              }
            >
              <option value="active">{t("installments.status.active")}</option>
              <option value="completed">{t("installments.status.completed")}</option>
              <option value="cancelled">{t("installments.status.cancelled")}</option>
            </select>
          </label>
        </p>

        <p>
          <button type="submit" disabled={isSubmitting}>
            {submitLabel}
          </button>{" "}
          {editingId ? (
            <button type="button" onClick={onCancelEdit}>
              {t("installments.cancelEdit")}
            </button>
          ) : null}
        </p>
      </form>

      {activeError ? <p>{t("installments.error", { message: activeError.message })}</p> : null}

      <h2>{t("installments.listTitle")}</h2>
      {!planQuery.data?.length ? (
        <p>{t("installments.empty")}</p>
      ) : (
        <ul>
          {planQuery.data.map((plan) => (
            <li key={plan.id}>
              <strong>{plan.description}</strong> -{" "}
              {formatCurrencyByLanguage(plan.totalAmount, plan.currency, i18n.language)} -{" "}
              {plan.months} {t("installments.monthsSuffix")} -{" "}
              {t(`installments.status.${plan.status}`)} -{" "}
              {t("installments.fields.startDate")}: {formatDateByLanguage(plan.startDate, i18n.language)} -{" "}
              {t("installments.generatedExpenses")}: {plan.expenses.length}{" "}
              <button type="button" onClick={() => onEdit(plan)}>
                {t("installments.edit")}
              </button>{" "}
              {plan.status !== "cancelled" ? (
                <button type="button" onClick={() => onCancelPlan(plan.id)}>
                  {t("installments.cancel")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
