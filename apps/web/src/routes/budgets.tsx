import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { rootRoute } from "./__root";
import { trpc } from "../utils/trpc";

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
  getParentRoute: () => rootRoute,
  path: "/budgets",
  component: BudgetsPage,
});

function BudgetsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  useEffect(() => {
    const unauthorized =
      (!listQuery.isLoading && listQuery.error?.data?.code === "UNAUTHORIZED") ||
      createMutation.error?.data?.code === "UNAUTHORIZED";
    if (unauthorized) {
      navigate({ to: "/" });
    }
  }, [
    createMutation.error?.data?.code,
    listQuery.error?.data?.code,
    listQuery.isLoading,
    navigate,
  ]);

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
    return <p>{t("budgets.loading")}</p>;
  }
  if (listQuery.error?.data?.code === "UNAUTHORIZED") return null;

  return (
    <div>
      <h1>{t("budgets.title")}</h1>
      <p>{t("budgets.description")}</p>

      <form onSubmit={onSubmit}>
        <p>
          <label>
            {t("budgets.fields.month")}{" "}
            <input
              type="number"
              min={1}
              max={12}
              value={form.month}
              onChange={(event) =>
                setForm((current) => ({ ...current, month: Number(event.target.value) }))
              }
              required
            />
          </label>{" "}
          <label>
            {t("budgets.fields.year")}{" "}
            <input
              type="number"
              min={2000}
              max={2100}
              value={form.year}
              onChange={(event) =>
                setForm((current) => ({ ...current, year: Number(event.target.value) }))
              }
              required
            />
          </label>
        </p>

        <p>
          <label>
            {t("budgets.fields.name")}{" "}
            <input
              type="text"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder={t("budgets.placeholders.name")}
            />
          </label>
        </p>

        <p>
          <button type="submit" disabled={createMutation.isPending}>
            {submitLabel}
          </button>
        </p>
      </form>

      {activeError ? (
        <p>{t("budgets.error", { message: activeError.message })}</p>
      ) : null}

      <h2>{t("budgets.listTitle")}</h2>
      <p>
        <label>
          {t("budgets.fields.filterYear")}{" "}
          <input
            type="number"
            min={2000}
            max={2100}
            value={selectedYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
          />
        </label>
      </p>

      {!listQuery.data?.length ? (
        <p>{t("budgets.empty")}</p>
      ) : (
        <ul>
          {listQuery.data.map((budget) => (
            <li key={budget.id}>
              <strong>
                {budget.year}-{String(budget.month).padStart(2, "0")}
              </strong>{" "}
              {budget.name ? <span>({budget.name})</span> : null}{" "}
              <a href={`/expenses?month=${budget.month}&year=${budget.year}`}>
                {t("budgets.openExpenses")}
              </a>{" "}
              <a href={`/dashboard?month=${budget.month}&year=${budget.year}`}>
                {t("budgets.openDashboard")}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
