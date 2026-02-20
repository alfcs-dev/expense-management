import { FormEvent, useMemo, useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { protectedRoute } from "./protected";
import { trpc } from "../utils/trpc";
import { formatCurrencyByLanguage, formatDateByLanguage } from "../utils/locale";
import { useTranslation } from "react-i18next";
import { Button } from "@components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/Card";
import { Input } from "@components/ui/Input";

export const billsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/bills",
  component: BillsPage,
});

function currentMonthInput(): string {
  return new Date().toISOString().slice(0, 7);
}

function BillsPage() {
  const { i18n } = useTranslation();
  const utils = trpc.useUtils();
  const [month, setMonth] = useState(currentMonthInput());

  const categoriesQuery = trpc.category.list.useQuery();
  const accountsQuery = trpc.account.list.useQuery();
  const billsQuery = trpc.bill.list.useQuery();
  const occurrencesQuery = trpc.bill.listOccurrences.useQuery({ month });

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amountType, setAmountType] = useState<"fixed" | "variable">("fixed");
  const [defaultAmount, setDefaultAmount] = useState("0");
  const [dueDay, setDueDay] = useState("15");
  const [payingAccountId, setPayingAccountId] = useState("");

  const createBillMutation = trpc.bill.create.useMutation({
    onSuccess: async () => {
      setName("");
      setCategoryId("");
      setAmountType("fixed");
      setDefaultAmount("0");
      setDueDay("15");
      setPayingAccountId("");
      await billsQuery.refetch();
    },
  });

  const generateMutation = trpc.bill.generateOccurrences.useMutation({
    onSuccess: async () => {
      await utils.bill.listOccurrences.invalidate();
    },
  });

  const statusMutation = trpc.bill.upsertOccurrenceStatus.useMutation({
    onSuccess: async () => {
      await utils.bill.listOccurrences.invalidate();
      await utils.dashboard.summary.invalidate();
    },
  });

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !categoryId) return;
    await createBillMutation.mutateAsync({
      name: name.trim(),
      categoryId,
      amountType,
      defaultAmount: Number(defaultAmount) || 0,
      dueDay: Number(dueDay) || 1,
      payingAccountId: payingAccountId || undefined,
      isActive: true,
    });
  };

  const currency = useMemo(() => {
    const firstAccountCurrency = (accountsQuery.data ?? [])[0]?.currency;
    return firstAccountCurrency ?? "MXN";
  }, [accountsQuery.data]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl px-4 py-10">
      <div className="grid w-full gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Bills</h1>
          <div className="flex items-center gap-2">
            <Input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => void generateMutation.mutateAsync({ month })}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending
                ? "Generating..."
                : "Generate month occurrences"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create recurring bill</CardTitle>
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
                Category
                <select
                  className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Select category</option>
                  {(categoriesQuery.data ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                Amount type
                <select
                  className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
                  value={amountType}
                  onChange={(event) =>
                    setAmountType(event.target.value as "fixed" | "variable")
                  }
                >
                  <option value="fixed">fixed</option>
                  <option value="variable">variable</option>
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                Default amount (minor units)
                <Input
                  type="number"
                  step={1}
                  value={defaultAmount}
                  onChange={(event) => setDefaultAmount(event.target.value)}
                />
              </label>

              <label className="grid gap-1 text-sm">
                Due day
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={dueDay}
                  onChange={(event) => setDueDay(event.target.value)}
                />
              </label>

              <label className="grid gap-1 text-sm md:col-span-2">
                Paying account
                <select
                  className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
                  value={payingAccountId}
                  onChange={(event) => setPayingAccountId(event.target.value)}
                >
                  <option value="">None</option>
                  {(accountsQuery.data ?? []).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-end">
                <Button type="submit" disabled={createBillMutation.isPending}>
                  {createBillMutation.isPending ? "Saving..." : "Create bill"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recurring bill templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(billsQuery.data ?? []).map((bill) => (
              <div key={bill.id} className="rounded-xl border border-border p-3">
                <p className="text-sm font-medium">{bill.name}</p>
                <p className="text-sm text-muted-foreground">
                  due day {bill.dueDay} · {bill.amountType} · {bill.category.name}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bill occurrences ({month})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(occurrencesQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Generate occurrences for this month first.
              </p>
            ) : null}
            {(occurrencesQuery.data ?? []).map((occurrence) => (
              <div key={occurrence.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{occurrence.bill.name}</p>
                  <p className="text-sm text-muted-foreground">{occurrence.status}</p>
                </div>
                <p className="text-sm">
                  Due: {formatDateByLanguage(occurrence.dueDate, i18n.language)}
                </p>
                <p className="text-sm">
                  Expected:{" "}
                  {formatCurrencyByLanguage(
                    occurrence.expectedAmount,
                    currency,
                    i18n.language,
                  )}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void statusMutation.mutateAsync({
                        occurrenceId: occurrence.id,
                        status: "pending",
                      })
                    }
                  >
                    Pending
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      void statusMutation.mutateAsync({
                        occurrenceId: occurrence.id,
                        status: "paid",
                      })
                    }
                  >
                    Mark paid
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
