import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { rootRoute } from "./__root";
import { formatDateByLanguage } from "../utils/locale";
import { trpc } from "../utils/trpc";

type ImportFormat = "csv" | "ofx" | "cfdi";

export const importsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/imports",
  component: ImportsPage,
});

function ImportsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [format, setFormat] = useState<ImportFormat>("csv");
  const [content, setContent] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [currency, setCurrency] = useState<"MXN" | "USD">("MXN");

  const accountsQuery = trpc.account.list.useQuery(undefined, { retry: false });
  const categoriesQuery = trpc.category.list.useQuery(undefined, { retry: false });
  const previewQuery = trpc.import.previewTransactions.useQuery(
    { format, content },
    { enabled: content.trim().length > 0, retry: false },
  );
  const applyMutation = trpc.import.applyTransactions.useMutation();
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categoriesQuery.data ?? []) {
      map.set(category.id, category.name);
    }
    return map;
  }, [categoriesQuery.data]);

  useEffect(() => {
    const unauthorized =
      (!accountsQuery.isLoading && accountsQuery.error?.data?.code === "UNAUTHORIZED") ||
      (!categoriesQuery.isLoading && categoriesQuery.error?.data?.code === "UNAUTHORIZED") ||
      (!previewQuery.isLoading && previewQuery.error?.data?.code === "UNAUTHORIZED") ||
      applyMutation.error?.data?.code === "UNAUTHORIZED";
    if (unauthorized) {
      navigate({ to: "/" });
    }
  }, [
    accountsQuery.error?.data?.code,
    accountsQuery.isLoading,
    applyMutation.error?.data?.code,
    categoriesQuery.error?.data?.code,
    categoriesQuery.isLoading,
    navigate,
    previewQuery.error?.data?.code,
    previewQuery.isLoading,
  ]);

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setContent(text);
  };

  const onApply = async () => {
    if (!accountId || !content.trim()) return;
    await applyMutation.mutateAsync({
      format,
      content,
      accountId,
      categoryId: categoryId || undefined,
      currency,
    });
  };

  if (accountsQuery.isLoading || categoriesQuery.isLoading) {
    return <p>{t("imports.loading")}</p>;
  }
  if (accountsQuery.error?.data?.code === "UNAUTHORIZED") return null;
  if (categoriesQuery.error?.data?.code === "UNAUTHORIZED") return null;

  const activeError =
    accountsQuery.error ??
    categoriesQuery.error ??
    previewQuery.error ??
    applyMutation.error;

  return (
    <div>
      <h1>{t("imports.title")}</h1>
      <p>{t("imports.description")}</p>

      <p>
        <label>
          {t("imports.fields.format")}{" "}
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value as ImportFormat)}
          >
            <option value="csv">CSV</option>
            <option value="ofx">OFX</option>
            <option value="cfdi">CFDI XML</option>
          </select>
        </label>
      </p>

      <p>
        <label>
            {t("imports.fields.file")}{" "}
          <input
            type="file"
            accept={
              format === "csv"
                ? ".csv,text/csv"
                : format === "ofx"
                  ? ".ofx,.qfx"
                  : ".xml,text/xml"
            }
            onChange={onFileChange}
          />
        </label>
      </p>

      <p>
        <label>
          {t("imports.fields.rawContent")}{" "}
          <textarea
            rows={10}
            cols={80}
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </label>
      </p>

      <p>
        <label>
          {t("imports.fields.account")}{" "}
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            <option value="">{t("imports.placeholders.selectAccount")}</option>
            {(accountsQuery.data ?? []).map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>{" "}
        <label>
          {t("imports.fields.category")}{" "}
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">{t("imports.placeholders.selectCategory")}</option>
            {(categoriesQuery.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>{" "}
        <span>{t("imports.hints.categoryOverride")}</span>{" "}
        <label>
          {t("imports.fields.currency")}{" "}
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value as "MXN" | "USD")}
          >
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </select>
        </label>
      </p>

      <p>
        <button type="button" onClick={() => void onApply()} disabled={applyMutation.isPending}>
          {applyMutation.isPending ? t("imports.applying") : t("imports.apply")}
        </button>
      </p>

      {activeError ? <p>{t("imports.error", { message: activeError.message })}</p> : null}
      {applyMutation.data ? (
        <p>
          {t("imports.result", {
            parsed: applyMutation.data.parsed,
            created: applyMutation.data.created,
          })}
        </p>
      ) : null}

      <h2>{t("imports.previewTitle")}</h2>
      {!content.trim() ? (
        <p>{t("imports.empty")}</p>
      ) : previewQuery.isLoading ? (
        <p>{t("imports.previewLoading")}</p>
      ) : !previewQuery.data?.rows.length ? (
        <p>{t("imports.previewEmpty")}</p>
      ) : (
        <ul>
          {previewQuery.data.rows.map((row, idx) => (
            <li key={`${row.description}-${idx}`}>
              {formatDateByLanguage(row.date, i18n.language)} - {(row.amount / 100).toFixed(2)} -{" "}
              {row.description}{" "}
              {row.suggestedCategoryId ? (
                <em>
                  ({t("imports.previewSuggestedCategory")}:{" "}
                  {categoryNameById.get(row.suggestedCategoryId) ?? row.suggestedCategoryId})
                </em>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
