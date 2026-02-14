import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { isValidClabe, normalizeClabe } from "@expense-management/shared";
import { rootRoute } from "./__root";
import { trpc } from "../utils/trpc";

const ACCOUNT_TYPES = ["debit", "credit", "investment", "cash"] as const;
const CURRENCIES = ["MXN", "USD"] as const;

type AccountType = (typeof ACCOUNT_TYPES)[number];
type Currency = (typeof CURRENCIES)[number];
type SelectableAccountType = AccountType | "";

type InstitutionOption = {
  code: string;
  bankCode: string | null;
  name: string;
};

type AccountFormValues = {
  name: string;
  type: SelectableAccountType;
  currency: Currency;
  institution: string;
  clabe: string;
  balance: string;
  creditLimit: string;
  currentDebt: string;
};

const INITIAL_FORM: AccountFormValues = {
  name: "",
  type: "",
  currency: "MXN",
  institution: "",
  clabe: "",
  balance: "0",
  creditLimit: "0",
  currentDebt: "0",
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

function formatCurrency(cents: number, currency: Currency): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function getPreferredInstitutionForBankCode(
  bankCode: string,
  institutions: InstitutionOption[],
): string | null {
  const candidates = institutions.filter((institution) => institution.bankCode === bankCode);
  if (candidates.length === 0) return null;

  const score = (code: string) => {
    if (code.startsWith("40")) return 0;
    if (code.startsWith("37")) return 1;
    if (code.startsWith("90")) return 2;
    return 3;
  };

  candidates.sort((a, b) => {
    const scoreDiff = score(a.code) - score(b.code);
    if (scoreDiff !== 0) return scoreDiff;
    return a.name.localeCompare(b.name);
  });

  return candidates[0]?.name ?? null;
}

export const accountsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/accounts",
  component: AccountsPage,
});

function AccountsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [form, setForm] = useState<AccountFormValues>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = trpc.account.list.useQuery(undefined, { retry: false });
  const institutionsQuery = trpc.account.institutions.useQuery(undefined, {
    retry: false,
  });

  const institutions = institutionsQuery.data ?? [];

  const normalizedClabe = normalizeClabe(form.clabe);
  const inferredInstitution = useMemo(() => {
    if (!/^\d{18}$/.test(normalizedClabe)) return null;
    if (!isValidClabe(normalizedClabe)) return null;
    return getPreferredInstitutionForBankCode(normalizedClabe.slice(0, 3), institutions);
  }, [institutions, normalizedClabe]);

  const hasInferableClabe =
    normalizedClabe.length === 18 && isValidClabe(normalizedClabe) && Boolean(inferredInstitution);

  const isInstitutionLocked =
    form.type === "debit" || (form.type === "credit" && hasInferableClabe);
  const isInstitutionDisabled = !form.type || isInstitutionLocked;
  const isClabeVisible = form.type === "debit" || form.type === "credit";

  const createMutation = trpc.account.create.useMutation({
    onSuccess: async () => {
      await utils.account.list.invalidate();
      setForm(INITIAL_FORM);
      setFormError(null);
    },
  });
  const updateMutation = trpc.account.update.useMutation({
    onSuccess: async () => {
      await utils.account.list.invalidate();
      setForm(INITIAL_FORM);
      setFormError(null);
      setEditingId(null);
    },
  });
  const deleteMutation = trpc.account.delete.useMutation({
    onSuccess: async () => {
      await utils.account.list.invalidate();
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const activeError =
    formError ??
    listQuery.error?.message ??
    institutionsQuery.error?.message ??
    createMutation.error?.message ??
    updateMutation.error?.message ??
    deleteMutation.error?.message;

  useEffect(() => {
    const unauthorized =
      (!listQuery.isLoading && listQuery.error?.data?.code === "UNAUTHORIZED") ||
      (!institutionsQuery.isLoading && institutionsQuery.error?.data?.code === "UNAUTHORIZED");

    if (unauthorized) {
      navigate({ to: "/" });
    }
  }, [
    institutionsQuery.error?.data?.code,
    institutionsQuery.isLoading,
    listQuery.error?.data?.code,
    listQuery.isLoading,
    navigate,
  ]);

  useEffect(() => {
    if (form.type === "debit") {
      if (inferredInstitution && form.institution !== inferredInstitution) {
        setForm((current) => ({ ...current, institution: inferredInstitution }));
        return;
      }

      if (!inferredInstitution && form.institution) {
        setForm((current) => ({ ...current, institution: "" }));
      }
      return;
    }

    if (
      form.type === "credit" &&
      hasInferableClabe &&
      inferredInstitution &&
      form.institution !== inferredInstitution
    ) {
      setForm((current) => ({ ...current, institution: inferredInstitution }));
    }
  }, [form.type, form.institution, inferredInstitution, hasInferableClabe]);

  const submitLabel = useMemo(() => {
    if (isSubmitting) return t("accounts.saving");
    return editingId ? t("accounts.update") : t("accounts.create");
  }, [editingId, isSubmitting, t]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!form.type) {
      setFormError(t("accounts.errors.typeRequired"));
      return;
    }

    if (form.type === "debit") {
      if (!hasInferableClabe || !inferredInstitution) {
        setFormError(t("accounts.errors.debitClabeRequired"));
        return;
      }
    }

    if (form.type === "credit" && !inferredInstitution && !form.institution.trim()) {
      setFormError(t("accounts.errors.creditInstitutionRequired"));
      return;
    }

    const institutionValue =
      (inferredInstitution ?? form.institution.trim()) || undefined;
    const clabeValue = normalizedClabe || undefined;

    const basePayload = {
      name: form.name.trim(),
      type: form.type,
      currency: form.currency,
      institution: institutionValue,
      clabe: clabeValue,
    };

    const payload =
      form.type === "credit"
        ? {
            ...basePayload,
            type: "credit" as const,
            creditLimit: parseDisplayToCents(form.creditLimit),
            currentDebt: parseDisplayToCents(form.currentDebt),
          }
        : {
            ...basePayload,
            type: form.type as Exclude<AccountType, "credit">,
            balance: parseDisplayToCents(form.balance),
          };

    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, data: payload });
      return;
    }

    await createMutation.mutateAsync(payload);
  };

  const onEdit = (account: NonNullable<typeof listQuery.data>[number]) => {
    setEditingId(account.id);
    setFormError(null);
    setForm({
      name: account.name,
      type: account.type,
      currency: account.currency,
      institution: account.institution ?? "",
      clabe: account.clabe ?? "",
      balance: centsToDisplay(account.balance),
      creditLimit: centsToDisplay(account.creditLimit ?? 0),
      currentDebt: centsToDisplay(account.currentDebt ?? 0),
    });
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormError(null);
  };

  const onDelete = async (id: string) => {
    if (!window.confirm(t("accounts.deleteConfirm"))) return;
    await deleteMutation.mutateAsync({ id });
  };

  if (listQuery.isLoading || institutionsQuery.isLoading) {
    return <p>{t("accounts.loading")}</p>;
  }

  if (listQuery.error?.data?.code === "UNAUTHORIZED") return null;
  if (institutionsQuery.error?.data?.code === "UNAUTHORIZED") return null;

  return (
    <div>
      <h1>{t("accounts.title")}</h1>
      <p>{t("accounts.description")}</p>

      <form onSubmit={onSubmit}>
        <p>
          <label>
            {t("accounts.fields.name")} {" "}
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
            {t("accounts.fields.type")} {" "}
            <select
              value={form.type}
              onChange={(event) => {
                const nextType = event.target.value as SelectableAccountType;
                setForm((current) => ({
                  ...current,
                  type: nextType,
                  institution: nextType ? current.institution : "",
                  clabe:
                    nextType === "debit" || nextType === "credit" ? current.clabe : "",
                }));
              }}
              required
            >
              <option value="">{t("accounts.placeholders.selectType")}</option>
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`accounts.types.${type}`)}
                </option>
              ))}
            </select>
          </label>
        </p>

        <p>
          <label>
            {t("accounts.fields.currency")} {" "}
            <select
              value={form.currency}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  currency: event.target.value as Currency,
                }))
              }
            >
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
        </p>

        {isClabeVisible ? (
          <p>
            <label>
              {t("accounts.fields.clabe")} {" "}
              <input
                type="text"
                inputMode="numeric"
                maxLength={18}
                value={form.clabe}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    clabe: normalizeClabe(event.target.value),
                  }))
                }
                required={form.type === "debit"}
              />
            </label>
            <br />
            <small>
              {form.type === "debit"
                ? t("accounts.hints.debitClabe")
                : t("accounts.hints.creditClabe")}
            </small>
          </p>
        ) : null}

        {form.type === "credit" ? (
          <>
            <p>
              <label>
                {t("accounts.fields.creditLimit")} {" "}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.creditLimit}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      creditLimit: event.target.value,
                    }))
                  }
                  required
                />
              </label>
            </p>
            <p>
              <label>
                {t("accounts.fields.currentDebt")} {" "}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.currentDebt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      currentDebt: event.target.value,
                    }))
                  }
                  required
                />
              </label>
            </p>
          </>
        ) : form.type ? (
          <p>
            <label>
              {t("accounts.fields.balance")} {" "}
              <input
                type="number"
                step="0.01"
                value={form.balance}
                onChange={(event) =>
                  setForm((current) => ({ ...current, balance: event.target.value }))
                }
                required
              />
            </label>
          </p>
        ) : null}

        <p>
          <label>
            {t("accounts.fields.institution")} {" "}
            <select
              value={form.institution}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  institution: event.target.value,
                }))
              }
              disabled={isInstitutionDisabled}
              required={form.type === "debit" || form.type === "credit"}
            >
              <option value="">{t("accounts.placeholders.selectInstitution")}</option>
              {institutions.map((institution) => (
                <option key={institution.code} value={institution.name}>
                  {institution.name}
                </option>
              ))}
            </select>
          </label>
        </p>

        <p>
          <button type="submit" disabled={isSubmitting}>
            {submitLabel}
          </button>{" "}
          {editingId ? (
            <button type="button" onClick={onCancelEdit}>
              {t("accounts.cancelEdit")}
            </button>
          ) : null}
        </p>
      </form>

      {activeError ? <p>{t("accounts.error", { message: activeError })}</p> : null}

      <h2>{t("accounts.listTitle")}</h2>
      {!listQuery.data?.length ? (
        <p>{t("accounts.empty")}</p>
      ) : (
        <ul>
          {listQuery.data.map((account) => (
            <li key={account.id}>
              <strong>{account.name}</strong>{" "}
              <span>
                ({t(`accounts.types.${account.type}`)} | {account.currency})
              </span>{" "}
              {account.type === "credit" ? (
                <>
                  <span>
                    {t("accounts.creditLimitLabel")}: {" "}
                    {formatCurrency(
                      account.creditLimit ?? 0,
                      account.currency as Currency,
                    )}
                  </span>{" "}
                  <span>
                    {t("accounts.currentDebtLabel")}: {" "}
                    {formatCurrency(
                      account.currentDebt ?? 0,
                      account.currency as Currency,
                    )}
                  </span>{" "}
                  <span>
                    {t("accounts.availableCreditLabel")}: {" "}
                    {formatCurrency(
                      (account.creditLimit ?? 0) - (account.currentDebt ?? 0),
                      account.currency as Currency,
                    )}
                  </span>{" "}
                </>
              ) : (
                <span>
                  {t("accounts.balanceLabel")}: {" "}
                  {formatCurrency(account.balance, account.currency as Currency)}
                </span>
              )}{" "}
              {account.institution ? (
                <span>
                  {t("accounts.institutionLabel")}: {account.institution}
                </span>
              ) : null}{" "}
              {account.clabe ? (
                <span>
                  {t("accounts.clabeLabel")}: {account.clabe}
                </span>
              ) : null}{" "}
              <button type="button" onClick={() => onEdit(account)}>
                {t("accounts.edit")}
              </button>{" "}
              <button type="button" onClick={() => onDelete(account.id)}>
                {t("accounts.delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
