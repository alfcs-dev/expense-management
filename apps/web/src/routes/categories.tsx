import { FormEvent, useMemo, useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { protectedRoute } from "./protected";
import { trpc } from "../utils/trpc";
import { PageShell, PageHeader, Section } from "../components/layout/page";
import { Alert } from "../components/ui/alert";
import { Button } from "../components/ui/button";

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
  getParentRoute: () => protectedRoute,
  path: "/categories",
  component: CategoriesPage,
});

function CategoriesPage() {
  const { t } = useTranslation();
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

  if (listQuery.isLoading)
    return (
      <PageShell>
        <p className="empty-text">{t("categories.loading")}</p>
      </PageShell>
    );
  if (listQuery.error?.data?.code === "UNAUTHORIZED") return null;

  return (
    <PageShell>
      <PageHeader
        title={t("categories.title")}
        description={t("categories.description")}
      />

      <Section>
        <form className="section-stack" onSubmit={onSubmit}>
          <p>
            <label>
              {t("categories.fields.name")}{" "}
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
              {t("categories.fields.icon")}{" "}
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
              {t("categories.fields.color")}{" "}
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

          <div className="form-actions">
            <Button type="submit" disabled={isSubmitting}>
              {submitLabel}
            </Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={onCancelEdit}>
                {t("categories.cancelEdit")}
              </Button>
            ) : null}
          </div>
        </form>
      </Section>

      {activeError ? (
        <Alert className="border-red-200 bg-red-50 text-red-700">
          {t("categories.error", { message: activeError.message })}
        </Alert>
      ) : null}

      <Section>
        <h2>{t("categories.listTitle")}</h2>
        {!listQuery.data?.length ? (
          <p className="empty-text">{t("categories.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {listQuery.data.map((category, index) => (
              <li
                key={category.id}
                className="rounded-md border border-slate-200 bg-slate-50 p-3"
              >
                <strong>{category.name}</strong>{" "}
                {category.icon ? <span>{category.icon}</span> : null}{" "}
                {category.color ? (
                  <span>
                    {t("categories.colorLabel")}: {category.color}
                  </span>
                ) : null}{" "}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onMove(category.id, "up")}
                  disabled={index === 0 || reorderMutation.isPending}
                >
                  {t("categories.moveUp")}
                </Button>{" "}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onMove(category.id, "down")}
                  disabled={
                    index === (listQuery.data?.length ?? 1) - 1 ||
                    reorderMutation.isPending
                  }
                >
                  {t("categories.moveDown")}
                </Button>{" "}
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => onEdit(category)}
                >
                  {t("categories.edit")}
                </Button>{" "}
                <Button
                  size="sm"
                  type="button"
                  variant="destructive"
                  onClick={() => onDelete(category.id)}
                >
                  {t("categories.delete")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </PageShell>
  );
}
