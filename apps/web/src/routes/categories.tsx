import { FormEvent, useMemo, useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { protectedRoute } from "./protected";
import { trpc } from "../utils/trpc";
import { CATEGORY_ICON_NAMES } from "@expense-management/shared";
import { Button } from "@components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/Card";
import { Input } from "@components/ui/Input";
import { CATEGORY_ICON_COMPONENTS } from "../assets/category-icons";

export const categoriesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/categories",
  component: CategoriesPage,
});

function CategoriesPage() {
  const utils = trpc.useUtils();
  const categoriesQuery = trpc.category.list.useQuery();

  const [name, setName] = useState("");
  const [kind, setKind] = useState<
    "income" | "expense" | "transfer" | "savings" | "debt"
  >("expense");
  const [color, setColor] = useState("#3B82F6");
  const [icon, setIcon] = useState<"" | (typeof CATEGORY_ICON_NAMES)[number]>("");
  const [parentId, setParentId] = useState("");

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const rootCategories = useMemo(
    () =>
      categories.filter(
        (category) => !category.parentId || !categoryById.has(category.parentId),
      ),
    [categories, categoryById],
  );
  const childrenByParentId = useMemo(() => {
    const map = new Map<string, typeof categories>();
    for (const category of categories) {
      if (!category.parentId) continue;
      const current = map.get(category.parentId) ?? [];
      current.push(category);
      map.set(category.parentId, current);
    }
    return map;
  }, [categories]);

  const createMutation = trpc.category.create.useMutation({
    onSuccess: async () => {
      setName("");
      setParentId("");
      setColor("#3B82F6");
      setIcon("");
      await utils.category.list.invalidate();
    },
  });

  const deleteMutation = trpc.category.delete.useMutation({
    onSuccess: async () => {
      await utils.category.list.invalidate();
    },
  });

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    await createMutation.mutateAsync({
      name: name.trim(),
      kind,
      color,
      icon: icon || undefined,
      parentId: parentId || undefined,
    });
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl px-4 py-10">
      <div className="grid w-full gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Create category</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 md:grid-cols-4"
              onSubmit={(event) => void onSubmit(event)}
            >
              <label className="grid gap-1 text-sm md:col-span-2">
                Name
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </label>

              <label className="grid gap-1 text-sm">
                Kind
                <select
                  className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
                  value={kind}
                  onChange={(event) =>
                    setKind(
                      event.target.value as
                        | "income"
                        | "expense"
                        | "transfer"
                        | "savings"
                        | "debt",
                    )
                  }
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="transfer">Transfer</option>
                  <option value="savings">Savings</option>
                  <option value="debt">Debt</option>
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                Color
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                    className="h-9 w-12 p-1"
                  />
                  <Input
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                    placeholder="#3B82F6"
                  />
                </div>
              </label>

              <label className="grid gap-1 text-sm md:col-span-2">
                Icon
                <select
                  className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
                  value={icon}
                  onChange={(event) =>
                    setIcon(
                      event.target.value as "" | (typeof CATEGORY_ICON_NAMES)[number],
                    )
                  }
                >
                  <option value="">No icon</option>
                  {CATEGORY_ICON_NAMES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm md:col-span-2">
                Parent (optional)
                <select
                  className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
                  value={parentId}
                  onChange={(event) => setParentId(event.target.value)}
                >
                  <option value="">No parent</option>
                  {categories
                    .filter((category) => category.kind === kind)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </label>

              <div className="flex items-end">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Create"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {categoriesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : null}
            {rootCategories.map((parent) => {
              const children = childrenByParentId.get(parent.id) ?? [];
              return (
                <div key={parent.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {parent.icon ? (
                        <span
                          className="inline-flex size-7 items-center justify-center rounded-full border border-border"
                          style={{ color: parent.color ?? undefined }}
                        >
                          {(() => {
                            const Icon =
                              CATEGORY_ICON_COMPONENTS[
                                parent.icon as keyof typeof CATEGORY_ICON_COMPONENTS
                              ] ?? CATEGORY_ICON_COMPONENTS.Circle;
                            return <Icon className="size-4" />;
                          })()}
                        </span>
                      ) : (
                        <span
                          className="inline-flex size-3 rounded-full border border-border"
                          style={{ backgroundColor: parent.color ?? "transparent" }}
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium">{parent.name}</p>
                        <p className="text-sm text-muted-foreground">{parent.kind}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void deleteMutation.mutateAsync({ id: parent.id })}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                  {parent.color ? (
                    <p className="mt-1 text-xs text-muted-foreground">{parent.color}</p>
                  ) : null}

                  {children.length > 0 ? (
                    <div className="mt-3 space-y-2 border-l border-border pl-4">
                      {children.map((child) => (
                        <div
                          key={child.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border/70 p-2"
                        >
                          <div className="flex items-center gap-2">
                            {child.icon ? (
                              <span
                                className="inline-flex size-7 items-center justify-center rounded-full border border-border"
                                style={{ color: child.color ?? undefined }}
                              >
                                {(() => {
                                  const Icon =
                                    CATEGORY_ICON_COMPONENTS[
                                      child.icon as keyof typeof CATEGORY_ICON_COMPONENTS
                                    ] ?? CATEGORY_ICON_COMPONENTS.Circle;
                                  return <Icon className="size-4" />;
                                })()}
                              </span>
                            ) : (
                              <span
                                className="inline-flex size-3 rounded-full border border-border"
                                style={{ backgroundColor: child.color ?? "transparent" }}
                              />
                            )}
                            <div>
                              <p className="text-sm font-medium">{child.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {child.kind}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void deleteMutation.mutateAsync({ id: child.id })
                            }
                            disabled={deleteMutation.isPending}
                          >
                            Delete
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
