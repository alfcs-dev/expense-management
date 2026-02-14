import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { rootRoute } from "./__root";
import { trpc } from "../utils/trpc";

type MatchType = "contains" | "exact" | "regex";

type RuleFormValues = {
  categoryId: string;
  pattern: string;
  matchType: MatchType;
};

const INITIAL_FORM: RuleFormValues = {
  categoryId: "",
  pattern: "",
  matchType: "contains",
};

export const categoryRulesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/category-rules",
  component: CategoryRulesPage,
});

function CategoryRulesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [form, setForm] = useState<RuleFormValues>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const categoriesQuery = trpc.category.list.useQuery(undefined, { retry: false });
  const rulesQuery = trpc.categoryMapping.list.useQuery(undefined, { retry: false });
  const createMutation = trpc.categoryMapping.create.useMutation({
    onSuccess: async () => {
      await utils.categoryMapping.list.invalidate();
      setForm(INITIAL_FORM);
    },
  });
  const updateMutation = trpc.categoryMapping.update.useMutation({
    onSuccess: async () => {
      await utils.categoryMapping.list.invalidate();
      setForm(INITIAL_FORM);
      setEditingId(null);
    },
  });
  const deleteMutation = trpc.categoryMapping.delete.useMutation({
    onSuccess: async () => {
      await utils.categoryMapping.list.invalidate();
    },
  });

  const isSubmitting =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const activeError =
    categoriesQuery.error ??
    rulesQuery.error ??
    createMutation.error ??
    updateMutation.error ??
    deleteMutation.error;

  useEffect(() => {
    const unauthorized =
      (!categoriesQuery.isLoading && categoriesQuery.error?.data?.code === "UNAUTHORIZED") ||
      (!rulesQuery.isLoading && rulesQuery.error?.data?.code === "UNAUTHORIZED") ||
      createMutation.error?.data?.code === "UNAUTHORIZED" ||
      updateMutation.error?.data?.code === "UNAUTHORIZED" ||
      deleteMutation.error?.data?.code === "UNAUTHORIZED";
    if (unauthorized) {
      navigate({ to: "/" });
    }
  }, [
    categoriesQuery.error?.data?.code,
    categoriesQuery.isLoading,
    createMutation.error?.data?.code,
    deleteMutation.error?.data?.code,
    navigate,
    rulesQuery.error?.data?.code,
    rulesQuery.isLoading,
    updateMutation.error?.data?.code,
  ]);

  const submitLabel = useMemo(() => {
    if (createMutation.isPending || updateMutation.isPending) {
      return t("categoryRules.saving");
    }
    return editingId ? t("categoryRules.update") : t("categoryRules.create");
  }, [createMutation.isPending, editingId, t, updateMutation.isPending]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      categoryId: form.categoryId,
      pattern: form.pattern.trim(),
      matchType: form.matchType,
    };

    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, data: payload });
      return;
    }

    await createMutation.mutateAsync(payload);
  };

  const onEdit = (rule: NonNullable<typeof rulesQuery.data>[number]) => {
    setEditingId(rule.id);
    setForm({
      categoryId: rule.categoryId,
      pattern: rule.pattern,
      matchType: rule.matchType as MatchType,
    });
  };

  const onDelete = async (id: string) => {
    if (!window.confirm(t("categoryRules.deleteConfirm"))) return;
    await deleteMutation.mutateAsync({ id });
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
  };

  if (categoriesQuery.isLoading || rulesQuery.isLoading) {
    return <p>{t("categoryRules.loading")}</p>;
  }
  if (categoriesQuery.error?.data?.code === "UNAUTHORIZED") return null;
  if (rulesQuery.error?.data?.code === "UNAUTHORIZED") return null;

  return (
    <div>
      <h1>{t("categoryRules.title")}</h1>
      <p>{t("categoryRules.description")}</p>

      <form onSubmit={onSubmit}>
        <p>
          <label>
            {t("categoryRules.fields.category")}{" "}
            <select
              value={form.categoryId}
              onChange={(event) =>
                setForm((current) => ({ ...current, categoryId: event.target.value }))
              }
              required
            >
              <option value="">{t("categoryRules.placeholders.selectCategory")}</option>
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
            {t("categoryRules.fields.pattern")}{" "}
            <input
              type="text"
              value={form.pattern}
              onChange={(event) =>
                setForm((current) => ({ ...current, pattern: event.target.value }))
              }
              required
            />
          </label>
        </p>

        <p>
          <label>
            {t("categoryRules.fields.matchType")}{" "}
            <select
              value={form.matchType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  matchType: event.target.value as MatchType,
                }))
              }
            >
              <option value="contains">{t("categoryRules.matchTypes.contains")}</option>
              <option value="exact">{t("categoryRules.matchTypes.exact")}</option>
              <option value="regex">{t("categoryRules.matchTypes.regex")}</option>
            </select>
          </label>
        </p>

        <p>
          <button type="submit" disabled={isSubmitting}>
            {submitLabel}
          </button>{" "}
          {editingId ? (
            <button type="button" onClick={onCancelEdit}>
              {t("categoryRules.cancelEdit")}
            </button>
          ) : null}
        </p>
      </form>

      {activeError ? <p>{t("categoryRules.error", { message: activeError.message })}</p> : null}

      <h2>{t("categoryRules.listTitle")}</h2>
      {!rulesQuery.data?.length ? (
        <p>{t("categoryRules.empty")}</p>
      ) : (
        <ul>
          {rulesQuery.data.map((rule) => (
            <li key={rule.id}>
              <strong>{rule.pattern}</strong> ({t(`categoryRules.matchTypes.${rule.matchType}`)}){" "}
              - {rule.category.name}{" "}
              <button type="button" onClick={() => onEdit(rule)}>
                {t("categoryRules.edit")}
              </button>{" "}
              <button type="button" onClick={() => void onDelete(rule.id)}>
                {t("categoryRules.delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
