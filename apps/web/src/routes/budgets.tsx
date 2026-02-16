import { FormEvent, useMemo, useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { protectedRoute } from "./protected";
import { trpc } from "../utils/trpc";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Alert } from "../components/ui/alert";
import { PageShell, PageHeader, Section } from "../components/layout/page";

type BudgetFormValues = {
  month: number;
  year: number;
  name: string;
};

const now = new Date();

const INITIAL_FORM: BudgetFormValues = {
  month: now.getMonth() + 1,
  year: now.getFullYear(),
  name: "",
};

export const budgetsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/budgets",
  component: BudgetsPage,
});

function BudgetsPage() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [form, setForm] = useState<BudgetFormValues>(INITIAL_FORM);

  const listQuery = trpc.budget.listByYear.useQuery(
    { year: selectedYear },
    { retry: false },
  );

  const createMutation = trpc.budget.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.budget.listByYear.invalidate({ year: selectedYear }),
        utils.budget.getOrCreateForMonth.invalidate({
          month: form.month,
          year: form.year,
        }),
      ]);
      setForm((current) => ({ ...current, name: "" }));
    },
  });

  const activeError = listQuery.error ?? createMutation.error;

  const submitLabel = useMemo(() => {
    if (createMutation.isPending) {
      return t("budgets.saving");
    }
    return t("budgets.create");
  }, [createMutation.isPending, t]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createMutation.mutateAsync({
      month: form.month,
      year: form.year,
      name: form.name.trim() || undefined,
    });
    if (form.year !== selectedYear) {
      setSelectedYear(form.year);
    }
  };

  if (listQuery.isLoading) {
    return (
      <PageShell>
        <p className="empty-text">{t("budgets.loading")}</p>
      </PageShell>
    );
  }
  if (listQuery.error?.data?.code === "UNAUTHORIZED") return null;

  return (
    <PageShell>
      <PageHeader title={t("budgets.title")} description={t("budgets.description")} />

      <Section>
        <form className="section-stack" onSubmit={onSubmit}>
          <div className="field-grid">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("budgets.fields.month")}
              </label>
              <Input
                type="number"
                min={1}
                max={12}
                value={form.month}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    month: Number(event.target.value),
                  }))
                }
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("budgets.fields.year")}
              </label>
              <Input
                type="number"
                min={2000}
                max={2100}
                value={form.year}
                onChange={(event) =>
                  setForm((current) => ({ ...current, year: Number(event.target.value) }))
                }
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("budgets.fields.name")}
            </label>
            <Input
              type="text"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder={t("budgets.placeholders.name")}
            />
          </div>

          <div className="form-actions">
            <Button type="submit" disabled={createMutation.isPending}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </Section>

      {activeError ? (
        <Alert className="border-red-200 bg-red-50 text-red-700">
          {t("budgets.error", { message: activeError.message })}
        </Alert>
      ) : null}

      <Section>
        <h2>{t("budgets.listTitle")}</h2>
        <div className="max-w-xs">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {t("budgets.fields.filterYear")}
          </label>
          <Input
            type="number"
            min={2000}
            max={2100}
            value={selectedYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
          />
        </div>

        {!listQuery.data?.length ? (
          <p className="empty-text">{t("budgets.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {listQuery.data.map((budget) => (
              <li
                key={budget.id}
                className="rounded-md border border-slate-200 bg-slate-50 p-3"
              >
                <div className="inline-row">
                  <strong>
                    {budget.year}-{String(budget.month).padStart(2, "0")}
                  </strong>
                  {budget.name ? <span className="muted">({budget.name})</span> : null}
                </div>
                <div className="inline-row mt-2">
                  <a href={`/expenses?month=${budget.month}&year=${budget.year}`}>
                    {t("budgets.openExpenses")}
                  </a>
                  <a href={`/?month=${budget.month}&year=${budget.year}`}>
                    {t("budgets.openDashboard")}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </PageShell>
  );
}
