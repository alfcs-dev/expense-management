import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { rootRoute } from "./__root";
import { trpc } from "../utils/trpc";

type CategoryFormValues = {
  name: string;
  icon: string;
  color: string;
};

const INITIAL_FORM: CategoryFormValues = {
  name: "",
  icon: "",
  color: "",
};

export const categoriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/categories",
  component: CategoriesPage,
});

function CategoriesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [form, setForm] = useState<CategoryFormValues>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const listQuery = trpc.category.list.useQuery(undefined, { retry: false });
  const createMutation = trpc.category.create.useMutation({
    onSuccess: async () => {
      await utils.category.list.invalidate();
      setForm(INITIAL_FORM);
    },
  });
  const updateMutation = trpc.category.update.useMutation({
    onSuccess: async () => {
      await utils.category.list.invalidate();
      setForm(INITIAL_FORM);
      setEditingId(null);
    },
  });
  const deleteMutation = trpc.category.delete.useMutation({
    onSuccess: async () => {
      await utils.category.list.invalidate();
    },
  });
  const reorderMutation = trpc.category.reorder.useMutation({
    onSuccess: async () => {
      await utils.category.list.invalidate();
    },
  });

  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    reorderMutation.isPending;

  const activeError =
    listQuery.error ??
    createMutation.error ??
    updateMutation.error ??
    deleteMutation.error ??
    reorderMutation.error;

  useEffect(() => {
    if (!listQuery.isLoading && listQuery.error?.data?.code === "UNAUTHORIZED") {
      navigate({ to: "/" });
    }
  }, [listQuery.isLoading, listQuery.error?.data?.code, navigate]);

  const submitLabel = useMemo(() => {
    if (createMutation.isPending || updateMutation.isPending) {
      return t("categories.saving");
    }
    return editingId ? t("categories.update") : t("categories.create");
  }, [createMutation.isPending, editingId, t, updateMutation.isPending]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      name: form.name.trim(),
      icon: form.icon.trim() || undefined,
      color: form.color.trim() || undefined,
    };

    if (editingId) {
      const current = listQuery.data?.find((category) => category.id === editingId);
      await updateMutation.mutateAsync({
        id: editingId,
        data: {
          ...payload,
          sortOrder: current?.sortOrder ?? 0,
        },
      });
      return;
    }

    await createMutation.mutateAsync(payload);
  };

  const onEdit = (category: NonNullable<typeof listQuery.data>[number]) => {
    setEditingId(category.id);
    setForm({
      name: category.name,
      icon: category.icon ?? "",
      color: category.color ?? "",
    });
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
  };

  const onDelete = async (id: string) => {
    if (!window.confirm(t("categories.deleteConfirm"))) return;
    await deleteMutation.mutateAsync({ id });
  };

  const onMove = async (id: string, direction: "up" | "down") => {
    if (!listQuery.data) return;

    const categories = [...listQuery.data];
    const index = categories.findIndex((category) => category.id === id);
    if (index < 0) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const [moved] = categories.splice(index, 1);
    categories.splice(targetIndex, 0, moved);

    await reorderMutation.mutateAsync({
      items: categories.map((category, nextIndex) => ({
        id: category.id,
        sortOrder: nextIndex,
      })),
    });
  };

  if (listQuery.isLoading) return <p>{t("categories.loading")}</p>;
  if (listQuery.error?.data?.code === "UNAUTHORIZED") return null;

  return (
    <div>
      <h1>{t("categories.title")}</h1>
      <p>{t("categories.description")}</p>

      <form onSubmit={onSubmit}>
        <p>
          <label>
            {t("categories.fields.name")} {" "}
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
            {t("categories.fields.icon")} {" "}
            <input
              type="text"
              value={form.icon}
              onChange={(event) =>
                setForm((current) => ({ ...current, icon: event.target.value }))
              }
            />
          </label>
        </p>

        <p>
          <label>
            {t("categories.fields.color")} {" "}
            <input
              type="text"
              placeholder="#1A2B3C"
              value={form.color}
              onChange={(event) =>
                setForm((current) => ({ ...current, color: event.target.value }))
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
              {t("categories.cancelEdit")}
            </button>
          ) : null}
        </p>
      </form>

      {activeError ? (
        <p>{t("categories.error", { message: activeError.message })}</p>
      ) : null}

      <h2>{t("categories.listTitle")}</h2>
      {!listQuery.data?.length ? (
        <p>{t("categories.empty")}</p>
      ) : (
        <ul>
          {listQuery.data.map((category, index) => (
            <li key={category.id}>
              <strong>{category.name}</strong>{" "}
              {category.icon ? <span>{category.icon}</span> : null}{" "}
              {category.color ? (
                <span>
                  {t("categories.colorLabel")}: {category.color}
                </span>
              ) : null}{" "}
              <button
                type="button"
                onClick={() => onMove(category.id, "up")}
                disabled={index === 0 || reorderMutation.isPending}
              >
                {t("categories.moveUp")}
              </button>{" "}
              <button
                type="button"
                onClick={() => onMove(category.id, "down")}
                disabled={
                  index === (listQuery.data?.length ?? 1) - 1 || reorderMutation.isPending
                }
              >
                {t("categories.moveDown")}
              </button>{" "}
              <button type="button" onClick={() => onEdit(category)}>
                {t("categories.edit")}
              </button>{" "}
              <button type="button" onClick={() => onDelete(category.id)}>
                {t("categories.delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
