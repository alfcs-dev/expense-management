import { FormEvent, useMemo, useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { protectedRoute } from "./protected";
import { trpc } from "../utils/trpc";
import { Button } from "@components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/Card";
import { Input } from "@components/ui/Input";

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
  const [parentId, setParentId] = useState("");

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

  const createMutation = trpc.category.create.useMutation({
    onSuccess: async () => {
      setName("");
      setParentId("");
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
              className="grid gap-3 md:grid-cols-3"
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
                  <option value="income">income</option>
                  <option value="expense">expense</option>
                  <option value="transfer">transfer</option>
                  <option value="savings">savings</option>
                  <option value="debt">debt</option>
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
            {categories.map((category) => {
              const parent = categories.find((item) => item.id === category.parentId);
              return (
                <div key={category.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{category.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {category.kind}
                        {parent ? ` · child of ${parent.name}` : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void deleteMutation.mutateAsync({ id: category.id })}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
