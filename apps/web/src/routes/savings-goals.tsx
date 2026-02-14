import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { rootRoute } from "./__root";
import { formatCurrencyByLanguage } from "../utils/locale";
import { trpc } from "../utils/trpc";

type SavingsGoalFormValues = {
  accountId: string;
  name: string;
  targetPercentage: string;
  targetAmount: string;
  currency: "MXN" | "USD";
  notes: string;
};

const INITIAL_FORM: SavingsGoalFormValues = {
  accountId: "",
  name: "",
  targetPercentage: "",
  targetAmount: "",
  currency: "MXN",
  notes: "",
};

function parseDisplayToCents(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const normalized = value.replace(/[$,\s]/g, "");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.round(parsed * 100);
}

function parsePercentage(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

export const savingsGoalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/savings-goals",
  component: SavingsGoalsPage,
});

function SavingsGoalsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [form, setForm] = useState<SavingsGoalFormValues>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const goalsQuery = trpc.savingsGoal.list.useQuery(undefined, { retry: false });
  const accountsQuery = trpc.account.list.useQuery(undefined, { retry: false });

  const createMutation = trpc.savingsGoal.create.useMutation({
    onSuccess: async () => {
      await utils.savingsGoal.list.invalidate();
      setForm(INITIAL_FORM);
    },
  });
  const updateMutation = trpc.savingsGoal.update.useMutation({
    onSuccess: async () => {
      await utils.savingsGoal.list.invalidate();
      setEditingId(null);
      setForm(INITIAL_FORM);
    },
  });
  const deleteMutation = trpc.savingsGoal.delete.useMutation({
    onSuccess: async () => {
      await utils.savingsGoal.list.invalidate();
    },
  });

  useEffect(() => {
    const unauthorized =
      (!goalsQuery.isLoading && goalsQuery.error?.data?.code === "UNAUTHORIZED") ||
      (!accountsQuery.isLoading && accountsQuery.error?.data?.code === "UNAUTHORIZED");

    if (unauthorized) {
      navigate({ to: "/" });
    }
  }, [
    accountsQuery.error?.data?.code,
    accountsQuery.isLoading,
    goalsQuery.error?.data?.code,
    goalsQuery.isLoading,
    navigate,
  ]);

  const isSubmitting =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const activeError =
    goalsQuery.error ??
    accountsQuery.error ??
    createMutation.error ??
    updateMutation.error ??
    deleteMutation.error;

  const submitLabel = useMemo(() => {
    if (createMutation.isPending || updateMutation.isPending) {
      return t("savingsGoals.saving");
    }
    return editingId ? t("savingsGoals.update") : t("savingsGoals.create");
  }, [createMutation.isPending, editingId, t, updateMutation.isPending]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      accountId: form.accountId,
      name: form.name.trim(),
      targetPercentage: parsePercentage(form.targetPercentage),
      targetAmount: parseDisplayToCents(form.targetAmount),
      currency: form.currency,
      notes: form.notes.trim() || undefined,
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

  const onEdit = (goal: NonNullable<typeof goalsQuery.data>[number]) => {
    setEditingId(goal.id);
    setForm({
      accountId: goal.accountId,
      name: goal.name,
      targetPercentage:
        goal.targetPercentage != null ? String(goal.targetPercentage) : "",
      targetAmount: goal.targetAmount != null ? (goal.targetAmount / 100).toFixed(2) : "",
      currency: goal.currency,
      notes: goal.notes ?? "",
    });
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
  };

  const onDelete = async (id: string) => {
    if (!window.confirm(t("savingsGoals.deleteConfirm"))) return;
    await deleteMutation.mutateAsync({ id });
  };

  if (goalsQuery.isLoading || accountsQuery.isLoading) {
    return <p>{t("savingsGoals.loading")}</p>;
  }
  if (goalsQuery.error?.data?.code === "UNAUTHORIZED") return null;
  if (accountsQuery.error?.data?.code === "UNAUTHORIZED") return null;

  return (
    <div>
      <h1>{t("savingsGoals.title")}</h1>
      <p>{t("savingsGoals.description")}</p>

      <form onSubmit={onSubmit}>
        <p>
          <label>
            {t("savingsGoals.fields.name")}{" "}
            <input
              type="text"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              required
            />
          </label>
        </p>

        <p>
          <label>
            {t("savingsGoals.fields.account")}{" "}
            <select
              value={form.accountId}
              onChange={(event) =>
                setForm((current) => ({ ...current, accountId: event.target.value }))
              }
              required
            >
              <option value="">{t("savingsGoals.placeholders.selectAccount")}</option>
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
            {t("savingsGoals.fields.targetPercentage")}{" "}
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.targetPercentage}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  targetPercentage: event.target.value,
                }))
              }
            />
          </label>
        </p>

        <p>
          <label>
            {t("savingsGoals.fields.targetAmount")}{" "}
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.targetAmount}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  targetAmount: event.target.value,
                }))
              }
            />
          </label>
        </p>

        <p>
          <label>
            {t("savingsGoals.fields.currency")}{" "}
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
            {t("savingsGoals.fields.notes")}{" "}
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </label>
        </p>

        <p>
          <button type="submit" disabled={isSubmitting}>
            {submitLabel}
          </button>{" "}
          {editingId ? (
            <button type="button" onClick={onCancelEdit}>
              {t("savingsGoals.cancelEdit")}
            </button>
          ) : null}
        </p>
      </form>

      {activeError ? <p>{t("savingsGoals.error", { message: activeError.message })}</p> : null}

      <h2>{t("savingsGoals.listTitle")}</h2>
      {!goalsQuery.data?.length ? (
        <p>{t("savingsGoals.empty")}</p>
      ) : (
        <ul>
          {goalsQuery.data.map((goal) => (
            <li key={goal.id}>
              <strong>{goal.name}</strong> - {goal.account.name} -{" "}
              {t("savingsGoals.progressLabel")}:{" "}
              {goal.progress.targetAmount != null
                ? `${formatCurrencyByLanguage(
                    goal.progress.currentAmount,
                    goal.currency,
                    i18n.language,
                  )} / ${formatCurrencyByLanguage(
                    goal.progress.targetAmount,
                    goal.currency,
                    i18n.language,
                  )}`
                : t("savingsGoals.noTarget")}{" "}
              {goal.progress.ratio != null
                ? `(${Math.round(goal.progress.ratio * 100)}%)`
                : ""}{" "}
              <button type="button" onClick={() => onEdit(goal)}>
                {t("savingsGoals.edit")}
              </button>{" "}
              <button type="button" onClick={() => onDelete(goal.id)}>
                {t("savingsGoals.delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
