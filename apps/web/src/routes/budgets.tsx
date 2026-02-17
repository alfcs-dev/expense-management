import { FormEvent, useMemo, useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { protectedRoute } from "./protected";
import { trpc } from "../utils/trpc";
import { Button } from "../components/ui/button";
import { Alert } from "../components/ui/alert";
import { PageShell, PageHeader, Section } from "../components/layout/page";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "../components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../components/ui/input-group";
import { CalendarIcon, PlusIcon, TagIcon } from "lucide-react";
import { Spinner } from "../components/ui/spinner";
import { formatCurrencyByLanguage, formatDateByLanguage } from "../utils/locale";

const now = new Date();

type BudgetFormValues = {
  name: string;
  startDate: string;
  endDate: string;
  currency: "MXN" | "USD";
  budgetLimit: string;
  isDefault: boolean;
};

function toDateInputValue(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const INITIAL_FORM: BudgetFormValues = {
  name: "",
  startDate: toDateInputValue(now),
  endDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  currency: "MXN",
  budgetLimit: "",
  isDefault: false,
};

function parseDisplayToCents(value: string): number {
  const normalized = value.replace(/[$,\s]/g, "");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

export const budgetsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/budgets",
  component: BudgetsPage,
});

function BudgetsPage() {
  const { t, i18n } = useTranslation();
  const utils = trpc.useUtils();

  const [form, setForm] = useState<BudgetFormValues>(INITIAL_FORM);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const listQuery = trpc.budget.list.useQuery(undefined, { retry: false });
  const createMutation = trpc.budget.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.budget.list.invalidate(),
        utils.budget.getDefault.invalidate(),
      ]);
      setForm(INITIAL_FORM);
      setIsCreateOpen(false);
    },
  });
  const setDefaultMutation = trpc.budget.setDefault.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.budget.list.invalidate(),
        utils.budget.getDefault.invalidate(),
      ]);
    },
  });

  const activeError = listQuery.error ?? createMutation.error ?? setDefaultMutation.error;

  const submitLabel = useMemo(() => {
    if (createMutation.isPending) {
      return t("budgets.saving");
    }

    return t("budgets.create");
  }, [createMutation.isPending, t]);

  const isFormValid = useMemo(() => {
    const nameValid = form.name.trim().length > 0;
    const startDate = new Date(`${form.startDate}T00:00:00`);
    const endDate = new Date(`${form.endDate}T23:59:59`);
    const rangeValid =
      Number.isFinite(startDate.getTime()) && Number.isFinite(endDate.getTime());
    const limitCents = parseDisplayToCents(form.budgetLimit);

    return nameValid && rangeValid && startDate <= endDate && limitCents >= 0;
  }, [form.budgetLimit, form.endDate, form.name, form.startDate]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await createMutation.mutateAsync({
      name: form.name.trim(),
      startDate: new Date(`${form.startDate}T00:00:00`),
      endDate: new Date(`${form.endDate}T23:59:59`),
      currency: form.currency,
      budgetLimit: parseDisplayToCents(form.budgetLimit),
      isDefault: form.isDefault,
    });
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
        <div className="flex items-center justify-between gap-3">
          <p className="muted">{t("budgets.description")}</p>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button type="button">
                <PlusIcon />
                {t("budgets.create")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("budgets.create")}</DialogTitle>
                <DialogDescription>{t("budgets.description")}</DialogDescription>
              </DialogHeader>

              <form onSubmit={onSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="budget-name">
                      {t("budgets.fields.name")}
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="budget-name"
                        type="text"
                        value={form.name}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, name: event.target.value }))
                        }
                        placeholder={t("budgets.placeholders.name")}
                        required
                      />
                      <InputGroupAddon>
                        <TagIcon />
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field>
                      <FieldLabel htmlFor="budget-start-date">
                        {t("budgets.fields.startDate")}
                      </FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          id="budget-start-date"
                          type="date"
                          value={form.startDate}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              startDate: event.target.value,
                            }))
                          }
                          required
                        />
                        <InputGroupAddon>
                          <CalendarIcon />
                        </InputGroupAddon>
                      </InputGroup>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="budget-end-date">
                        {t("budgets.fields.endDate")}
                      </FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          id="budget-end-date"
                          type="date"
                          value={form.endDate}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              endDate: event.target.value,
                            }))
                          }
                          required
                        />
                        <InputGroupAddon>
                          <CalendarIcon />
                        </InputGroupAddon>
                      </InputGroup>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field>
                      <FieldLabel htmlFor="budget-currency">
                        {t("budgets.fields.currency")}
                      </FieldLabel>
                      <select
                        id="budget-currency"
                        value={form.currency}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            currency: event.target.value as "MXN" | "USD",
                          }))
                        }
                        required
                      >
                        <option value="MXN">MXN</option>
                        <option value="USD">USD</option>
                      </select>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="budget-limit">
                        {t("budgets.fields.limit")}
                      </FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          id="budget-limit"
                          type="number"
                          min={0}
                          step="0.01"
                          value={form.budgetLimit}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              budgetLimit: event.target.value,
                            }))
                          }
                          placeholder={t("budgets.placeholders.limit")}
                          required
                        />
                      </InputGroup>
                    </Field>
                  </div>

                  <Field>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.isDefault}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            isDefault: event.target.checked,
                          }))
                        }
                      />
                      {t("budgets.fields.isDefault")}
                    </label>
                  </Field>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setIsCreateOpen(false)}
                      disabled={createMutation.isPending}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || !isFormValid}
                    >
                      {createMutation.isPending ? (
                        <Spinner data-icon="inline-start" />
                      ) : null}
                      {submitLabel}
                    </Button>
                  </DialogFooter>
                </FieldGroup>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </Section>

      {activeError ? (
        <Alert className="border-red-200 bg-red-50 text-red-700">
          {t("budgets.error", { message: activeError.message })}
        </Alert>
      ) : null}

      <Section>
        <h2>{t("budgets.listTitle")}</h2>

        {!listQuery.data?.length ? (
          <p className="empty-text">{t("budgets.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {listQuery.data.map((budget) => (
              <li
                key={budget.id}
                className="rounded-md border border-slate-200 bg-slate-50 p-3"
              >
                <div className="inline-row items-center justify-between">
                  <div>
                    <strong>{budget.name}</strong>
                    {budget.isDefault ? (
                      <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                        {t("budgets.defaultTag")}
                      </span>
                    ) : null}
                  </div>
                  {!budget.isDefault ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDefaultMutation.mutate({ id: budget.id })}
                      disabled={setDefaultMutation.isPending}
                    >
                      {t("budgets.setDefault")}
                    </Button>
                  ) : null}
                </div>

                <p className="muted mt-2">
                  {formatDateByLanguage(budget.startDate, i18n.language)} -{" "}
                  {formatDateByLanguage(budget.endDate, i18n.language)}
                </p>
                <p className="muted">
                  {formatCurrencyByLanguage(
                    budget.budgetLimit,
                    budget.currency,
                    i18n.language,
                  )}{" "}
                  ({budget.currency})
                </p>

                <div className="inline-row mt-2">
                  <a href={`/expenses?budgetId=${budget.id}`}>
                    {t("budgets.openExpenses")}
                  </a>
                  <a href={`/?budgetId=${budget.id}`}>{t("budgets.openDashboard")}</a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </PageShell>
  );
}
