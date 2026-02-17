import { FormEvent, useMemo, useRef, useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { protectedRoute } from "./protected";
import { trpc } from "../utils/trpc";
import { PageShell, PageHeader, Section } from "../components/layout/page";
import { Alert } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Field, FieldGroup, FieldLabel } from "../components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../components/ui/input-group";
import { PaletteIcon, PlusIcon, TagIcon } from "lucide-react";
import { Spinner } from "../components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

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

const CATEGORY_ICON_OPTIONS = [
  "🍔",
  "🛒",
  "🏠",
  "🚗",
  "💊",
  "🎓",
  "🎬",
  "✈️",
  "💼",
  "💡",
  "🏋️",
  "🎁",
] as const;

function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  const shortMatch = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  const fullMatch = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
  if (fullMatch) {
    return `#${fullMatch[1].toLowerCase()}`;
  }

  return null;
}

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
  const [isFormOpen, setIsFormOpen] = useState(false);
  const colorInputRef = useRef<HTMLInputElement | null>(null);

  const listQuery = trpc.category.list.useQuery(undefined, { retry: false });
  const createMutation = trpc.category.create.useMutation({
    onSuccess: async () => {
      await utils.category.list.invalidate();
      setForm(INITIAL_FORM);
      setIsFormOpen(false);
    },
  });
  const updateMutation = trpc.category.update.useMutation({
    onSuccess: async () => {
      await utils.category.list.invalidate();
      setForm(INITIAL_FORM);
      setEditingId(null);
      setIsFormOpen(false);
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

  const isFormValid = useMemo(() => {
    const hasName = form.name.trim().length > 0;
    const hasValidColor =
      form.color.trim().length === 0 || Boolean(normalizeHexColor(form.color));
    return hasName && hasValidColor;
  }, [form.color, form.name]);

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
    setIsFormOpen(true);
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setIsFormOpen(false);
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
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title={t("categories.title")}
          description={t("categories.description")}
        />
        <Popover
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open && editingId) {
              setEditingId(null);
              setForm(INITIAL_FORM);
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button type="button">
              <PlusIcon />
              {editingId ? t("categories.update") : t("categories.create")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[420px]">
            <div className="mb-4">
              <h3 className="text-base font-semibold">
                {editingId ? t("categories.update") : t("categories.create")}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t("categories.description")}
              </p>
            </div>

            <form onSubmit={onSubmit}>
              <FieldGroup>
                <div className="grid grid-cols-[1fr_128px] items-start gap-3">
                  <Field>
                    <FieldLabel htmlFor="category-name">
                      {t("categories.fields.name")}
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="category-name"
                        type="text"
                        value={form.name}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        required
                        placeholder={t("categories.fields.name")}
                      />
                      <InputGroupAddon>
                        <TagIcon />
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="category-icon">
                      {t("categories.fields.icon")}
                    </FieldLabel>
                    <Select
                      value={form.icon || "__none"}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          icon: value === "__none" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full" id="category-icon">
                        <SelectValue placeholder={t("categories.fields.icon")} />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value="__none">No icon</SelectItem>
                        {CATEGORY_ICON_OPTIONS.map((icon) => (
                          <SelectItem key={icon} value={icon}>
                            {icon}
                          </SelectItem>
                        ))}
                        {form.icon &&
                        !CATEGORY_ICON_OPTIONS.includes(
                          form.icon as (typeof CATEGORY_ICON_OPTIONS)[number],
                        ) ? (
                          <SelectItem value={form.icon}>{form.icon}</SelectItem>
                        ) : null}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="category-color">
                    {t("categories.fields.color")}
                  </FieldLabel>
                  <div className="flex items-center gap-2">
                    <input
                      ref={colorInputRef}
                      type="color"
                      aria-label={t("categories.fields.color")}
                      value={normalizeHexColor(form.color) ?? "#64748b"}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          color: event.target.value,
                        }))
                      }
                      className="border-input bg-input/30 h-9 w-12 cursor-pointer rounded-2xl border p-1"
                    />
                    <InputGroup>
                      <InputGroupInput
                        id="category-color"
                        type="text"
                        placeholder="#1A2B3C"
                        value={form.color}
                        onClick={() => colorInputRef.current?.click()}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            color: event.target.value,
                          }))
                        }
                      />
                      <InputGroupAddon>
                        <PaletteIcon />
                      </InputGroupAddon>
                    </InputGroup>
                  </div>
                </Field>

                <Field>
                  <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={onCancelEdit}>
                      {editingId ? t("categories.cancelEdit") : t("common.cancel")}
                    </Button>
                    <Button type="submit" disabled={isSubmitting || !isFormValid}>
                      {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
                      {submitLabel}
                    </Button>
                  </div>
                </Field>
              </FieldGroup>
            </form>
          </PopoverContent>
        </Popover>
      </div>

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
