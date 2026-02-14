import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { rootRoute } from "./__root";
import { formatCurrencyByLanguage, formatDateByLanguage } from "../utils/locale";
import { trpc } from "../utils/trpc";

type TransferFormValues = {
  sourceAccountId: string;
  destAccountId: string;
  amount: string;
  currency: "MXN" | "USD";
  date: string;
  notes: string;
};

const now = new Date();

const INITIAL_FORM: TransferFormValues = {
  sourceAccountId: "",
  destAccountId: "",
  amount: "",
  currency: "MXN",
  date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
  notes: "",
};

function parseDisplayToCents(value: string): number {
  const normalized = value.replace(/[$,\s]/g, "");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

export const transfersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/transfers",
  component: TransfersPage,
});

function TransfersPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [form, setForm] = useState<TransferFormValues>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const transferQuery = trpc.transfer.list.useQuery(undefined, { retry: false });
  const accountsQuery = trpc.account.list.useQuery(undefined, { retry: false });

  const createMutation = trpc.transfer.create.useMutation({
    onSuccess: async () => {
      await utils.transfer.list.invalidate();
      setForm(INITIAL_FORM);
    },
  });
  const updateMutation = trpc.transfer.update.useMutation({
    onSuccess: async () => {
      await utils.transfer.list.invalidate();
      setEditingId(null);
      setForm(INITIAL_FORM);
    },
  });
  const deleteMutation = trpc.transfer.delete.useMutation({
    onSuccess: async () => {
      await utils.transfer.list.invalidate();
    },
  });

  useEffect(() => {
    const unauthorized =
      (!transferQuery.isLoading && transferQuery.error?.data?.code === "UNAUTHORIZED") ||
      (!accountsQuery.isLoading && accountsQuery.error?.data?.code === "UNAUTHORIZED");
    if (unauthorized) {
      navigate({ to: "/" });
    }
  }, [
    accountsQuery.error?.data?.code,
    accountsQuery.isLoading,
    navigate,
    transferQuery.error?.data?.code,
    transferQuery.isLoading,
  ]);

  const isSubmitting =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const activeError =
    transferQuery.error ??
    accountsQuery.error ??
    createMutation.error ??
    updateMutation.error ??
    deleteMutation.error;

  const submitLabel = useMemo(() => {
    if (createMutation.isPending || updateMutation.isPending) {
      return t("transfers.saving");
    }
    return editingId ? t("transfers.update") : t("transfers.create");
  }, [createMutation.isPending, editingId, t, updateMutation.isPending]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      sourceAccountId: form.sourceAccountId,
      destAccountId: form.destAccountId,
      amount: parseDisplayToCents(form.amount),
      currency: form.currency,
      date: new Date(`${form.date}T12:00:00`),
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

  const onEdit = (transfer: NonNullable<typeof transferQuery.data>[number]) => {
    setEditingId(transfer.id);
    setForm({
      sourceAccountId: transfer.sourceAccountId,
      destAccountId: transfer.destAccountId,
      amount: (transfer.amount / 100).toFixed(2),
      currency: transfer.currency,
      date: new Date(transfer.date).toISOString().slice(0, 10),
      notes: transfer.notes ?? "",
    });
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
  };

  const onDelete = async (id: string) => {
    if (!window.confirm(t("transfers.deleteConfirm"))) return;
    await deleteMutation.mutateAsync({ id });
  };

  if (transferQuery.isLoading || accountsQuery.isLoading) {
    return <p>{t("transfers.loading")}</p>;
  }
  if (transferQuery.error?.data?.code === "UNAUTHORIZED") return null;
  if (accountsQuery.error?.data?.code === "UNAUTHORIZED") return null;

  return (
    <div>
      <h1>{t("transfers.title")}</h1>
      <p>{t("transfers.description")}</p>

      <form onSubmit={onSubmit}>
        <p>
          <label>
            {t("transfers.fields.sourceAccount")}{" "}
            <select
              value={form.sourceAccountId}
              onChange={(event) =>
                setForm((current) => ({ ...current, sourceAccountId: event.target.value }))
              }
              required
            >
              <option value="">{t("transfers.placeholders.selectSource")}</option>
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
            {t("transfers.fields.destAccount")}{" "}
            <select
              value={form.destAccountId}
              onChange={(event) =>
                setForm((current) => ({ ...current, destAccountId: event.target.value }))
              }
              required
            >
              <option value="">{t("transfers.placeholders.selectDest")}</option>
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
            {t("transfers.fields.amount")}{" "}
            <input
              type="number"
              min="0"
              step="0.01"
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
            {t("transfers.fields.currency")}{" "}
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
            {t("transfers.fields.date")}{" "}
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
          <label>
            {t("transfers.fields.notes")}{" "}
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
              {t("transfers.cancelEdit")}
            </button>
          ) : null}
        </p>
      </form>

      {activeError ? <p>{t("transfers.error", { message: activeError.message })}</p> : null}

      <h2>{t("transfers.listTitle")}</h2>
      {!transferQuery.data?.length ? (
        <p>{t("transfers.empty")}</p>
      ) : (
        <ul>
          {transferQuery.data.map((transfer) => (
            <li key={transfer.id}>
              <strong>{transfer.sourceAccount.name}</strong> →{" "}
              <strong>{transfer.destAccount.name}</strong> -{" "}
              {formatCurrencyByLanguage(transfer.amount, transfer.currency, i18n.language)} -{" "}
              {formatDateByLanguage(transfer.date, i18n.language)}{" "}
              {transfer.notes ? `- ${transfer.notes}` : ""}{" "}
              <button type="button" onClick={() => onEdit(transfer)}>
                {t("transfers.edit")}
              </button>{" "}
              <button type="button" onClick={() => onDelete(transfer.id)}>
                {t("transfers.delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
