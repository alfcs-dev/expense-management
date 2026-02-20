import { FormEvent, useMemo, useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { protectedRoute } from "./protected";
import { trpc } from "../utils/trpc";
import { formatCurrencyByLanguage } from "../utils/locale";
import { useTranslation } from "react-i18next";
import { Button } from "@components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/Card";
import { Input } from "@components/ui/Input";

export const budgetsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/budgets",
  component: BudgetsPage,
});

function currentMonthInput(): string {
  return new Date().toISOString().slice(0, 7);
}

function BudgetsPage() {
  const { i18n } = useTranslation();
  const utils = trpc.useUtils();
  const categoriesQuery = trpc.category.list.useQuery();
  const periodsQuery = trpc.budgetPeriod.list.useQuery();
  const rulesQuery = trpc.budgetRule.list.useQuery();

  const [month, setMonth] = useState(currentMonthInput());
  const [expectedIncomeAmount, setExpectedIncomeAmount] = useState("0");

  const selectedPeriod = useMemo(
    () => (periodsQuery.data ?? []).find((period) => period.month === month) ?? null,
    [periodsQuery.data, month],
  );

  const allocationQuery = trpc.budgetAllocation.list.useQuery(
    { budgetPeriodId: selectedPeriod?.id ?? "" },
    { enabled: Boolean(selectedPeriod?.id) },
  );

  const createPeriodMutation = trpc.budgetPeriod.create.useMutation({
    onSuccess: async () => {
      await periodsQuery.refetch();
    },
  });

  const generateMutation = trpc.budgetAllocation.generateForPeriod.useMutation({
    onSuccess: async () => {
      await utils.budgetAllocation.list.invalidate();
    },
  });

  const [ruleName, setRuleName] = useState("");
  const [ruleCategoryId, setRuleCategoryId] = useState("");
  const [ruleType, setRuleType] = useState<"fixed" | "percent_of_income">("fixed");
  const [ruleValue, setRuleValue] = useState("0");

  const createRuleMutation = trpc.budgetRule.create.useMutation({
    onSuccess: async () => {
      setRuleName("");
      setRuleCategoryId("");
      setRuleType("fixed");
      setRuleValue("0");
      await rulesQuery.refetch();
    },
  });

  const onCreatePeriod = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedPeriod) return;
    await createPeriodMutation.mutateAsync({
      month,
      currency: "MXN",
      expectedIncomeAmount: Number(expectedIncomeAmount) || 0,
    });
  };

  const onCreateRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ruleName.trim() || !ruleCategoryId) return;
    await createRuleMutation.mutateAsync({
      name: ruleName.trim(),
      categoryId: ruleCategoryId,
      ruleType,
      value: Number(ruleValue) || 0,
      applyOrder: 0,
    });
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl px-4 py-10">
      <div className="grid w-full gap-6">
        <h1 className="text-xl font-semibold">Budgets</h1>

        <Card>
          <CardHeader>
            <CardTitle>Budget period</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 md:grid-cols-3"
              onSubmit={(event) => void onCreatePeriod(event)}
            >
              <label className="grid gap-1 text-sm">
                Month
                <Input
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Expected income (minor units)
                <Input
                  type="number"
                  step={1}
                  value={expectedIncomeAmount}
                  onChange={(event) => setExpectedIncomeAmount(event.target.value)}
                />
              </label>
              <div className="flex items-end gap-2">
                <Button
                  type="submit"
                  disabled={createPeriodMutation.isPending || Boolean(selectedPeriod)}
                >
                  {selectedPeriod
                    ? "Period exists"
                    : createPeriodMutation.isPending
                      ? "Creating..."
                      : "Create period"}
                </Button>
                {selectedPeriod ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      void generateMutation.mutateAsync({
                        budgetPeriodId: selectedPeriod.id,
                      })
                    }
                    disabled={generateMutation.isPending}
                  >
                    {generateMutation.isPending
                      ? "Generating..."
                      : "Generate allocations"}
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Allocation rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form
              className="grid gap-3 md:grid-cols-4"
              onSubmit={(event) => void onCreateRule(event)}
            >
              <label className="grid gap-1 text-sm md:col-span-2">
                Rule name
                <Input
                  value={ruleName}
                  onChange={(event) => setRuleName(event.target.value)}
                />
              </label>

              <label className="grid gap-1 text-sm">
                Category
                <select
                  className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
                  value={ruleCategoryId}
                  onChange={(event) => setRuleCategoryId(event.target.value)}
                >
                  <option value="">Select category</option>
                  {(categoriesQuery.data ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex gap-2">
                <select
                  className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
                  value={ruleType}
                  onChange={(event) =>
                    setRuleType(event.target.value as "fixed" | "percent_of_income")
                  }
                >
                  <option value="fixed">fixed</option>
                  <option value="percent_of_income">percent_of_income</option>
                </select>
                <Input
                  type="number"
                  step={1}
                  value={ruleValue}
                  onChange={(event) => setRuleValue(event.target.value)}
                />
                <Button type="submit" disabled={createRuleMutation.isPending}>
                  Add
                </Button>
              </div>
            </form>

            {(rulesQuery.data ?? []).map((rule) => (
              <div key={rule.id} className="rounded-xl border border-border p-3 text-sm">
                <p className="font-medium">{rule.name}</p>
                <p className="text-muted-foreground">
                  {rule.category.name} · {rule.ruleType} · {rule.value}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generated allocations ({month})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!selectedPeriod ? (
              <p className="text-sm text-muted-foreground">
                Create a budget period first.
              </p>
            ) : null}
            {(allocationQuery.data ?? []).map((item) => (
              <div key={item.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{item.category.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.isOverride ? "override" : "rule"}
                  </p>
                </div>
                <p className="text-sm">
                  {formatCurrencyByLanguage(
                    item.plannedAmount,
                    selectedPeriod?.currency ?? "MXN",
                    i18n.language,
                  )}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
