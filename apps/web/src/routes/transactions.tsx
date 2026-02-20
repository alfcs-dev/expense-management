import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { protectedRoute } from "./protected";
import { trpc } from "../utils/trpc";
import { formatCurrencyByLanguage, formatDateByLanguage } from "../utils/locale";
import { Button } from "@components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/Card";
import { Input } from "@components/ui/Input";

type TransactionMode = "deposit" | "expense";

export const transactionsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/transactions",
  component: TransactionsListPage,
});

export const transactionsDepositRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/transactions/deposit",
  component: TransactionsDepositPage,
});

export const transactionsExpenseRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/transactions/expense",
  component: TransactionsExpensePage,
});

function toDateInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function TransactionsDepositPage() {
  return <TransactionPostPage mode="deposit" />;
}

function TransactionsExpensePage() {
  return <TransactionPostPage mode="expense" />;
}

function TransactionsListPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const accountsQuery = trpc.account.list.useQuery();
  const categoriesQuery = trpc.category.list.useQuery();

  const [accountIdFilter, setAccountIdFilter] = useState("");
  const [categoryIdFilter, setCategoryIdFilter] = useState("");
  const [fromDateFilter, setFromDateFilter] = useState("");
  const [toDateFilter, setToDateFilter] = useState("");

  const queryInput = useMemo(() => {
    if (!accountIdFilter && !categoryIdFilter && !fromDateFilter && !toDateFilter) {
      return undefined;
    }
    return {
      accountId: accountIdFilter || undefined,
      categoryId: categoryIdFilter || undefined,
      fromDate: fromDateFilter ? new Date(`${fromDateFilter}T00:00:00.000Z`) : undefined,
      toDate: toDateFilter ? new Date(`${toDateFilter}T23:59:59.999Z`) : undefined,
    };
  }, [accountIdFilter, categoryIdFilter, fromDateFilter, toDateFilter]);

  const transactionsQuery = trpc.transaction.list.useQuery(queryInput);

  const updateMutation = trpc.transaction.update.useMutation({
    onSuccess: async () => {
      await utils.transaction.list.invalidate();
      await utils.dashboard.summary.invalidate();
    },
  });

  const paidMutation = trpc.transaction.updatePaidStatus.useMutation({
    onSuccess: async () => {
      await utils.transaction.list.invalidate();
      await utils.dashboard.summary.invalidate();
    },
  });

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl px-4 py-10">
      <div className="grid w-full gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={() => void navigate({ to: "/transactions/expense" })}>
              Register Expense
            </Button>
            <Button
              variant="outline"
              onClick={() => void navigate({ to: "/transactions/deposit" })}
            >
              Register Deposit
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <label className="grid gap-1 text-sm">
              Account
              <select
                className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
                value={accountIdFilter}
                onChange={(event) => setAccountIdFilter(event.target.value)}
              >
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              Category
              <select
                className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
                value={categoryIdFilter}
                onChange={(event) => setCategoryIdFilter(event.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              From date
              <Input
                type="date"
                value={fromDateFilter}
                onChange={(event) => setFromDateFilter(event.target.value)}
              />
            </label>

            <label className="grid gap-1 text-sm">
              To date
              <Input
                type="date"
                value={toDateFilter}
                onChange={(event) => setToDateFilter(event.target.value)}
              />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction List</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {transactionsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : null}
            {!transactionsQuery.isLoading &&
            (transactionsQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions found.</p>
            ) : null}

            {(transactionsQuery.data ?? []).map((transaction) => (
              <div key={transaction.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{transaction.description}</p>
                  <p className="text-sm">
                    {formatCurrencyByLanguage(
                      transaction.amount,
                      transaction.account.currency,
                      i18n.language,
                    )}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {transaction.account.name} · {transaction.category.name} ·{" "}
                  {formatDateByLanguage(transaction.date, i18n.language)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Status: {transaction.isPaid ? "paid" : "pending"}
                </p>
                {transaction.notes ? (
                  <p className="text-sm text-muted-foreground">{transaction.notes}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={transaction.isPaid ? "outline" : "default"}
                    onClick={() =>
                      void paidMutation.mutateAsync({
                        id: transaction.id,
                        isPaid: !transaction.isPaid,
                      })
                    }
                    disabled={paidMutation.isPending}
                  >
                    {transaction.isPaid ? "Mark unpaid" : "Mark paid"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const nextDescription = window.prompt(
                        "Edit description",
                        transaction.description,
                      );
                      if (!nextDescription?.trim()) return;
                      void updateMutation.mutateAsync({
                        id: transaction.id,
                        data: { description: nextDescription.trim() },
                      });
                    }}
                    disabled={updateMutation.isPending}
                  >
                    Edit description
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

function TransactionPostPage({ mode }: { mode: TransactionMode }) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const accountsQuery = trpc.account.list.useQuery();
  const categoriesQuery = trpc.category.list.useQuery();
  const recentTransactionsQuery = trpc.transaction.list.useQuery();

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const filteredCategories = useMemo(
    () =>
      categories.filter((category) =>
        mode === "deposit" ? category.kind === "income" : category.kind === "expense",
      ),
    [categories, mode],
  );

  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toDateInput(new Date()));
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const defaultCategoryId = useMemo(() => {
    const defaultName = mode === "deposit" ? "Income" : "Expenses";
    return (
      filteredCategories.find((category) => category.name === defaultName)?.id ??
      filteredCategories[0]?.id ??
      ""
    );
  }, [filteredCategories, mode]);

  const createMutation = trpc.transaction.create.useMutation({
    onSuccess: async () => {
      setFormError(null);
      setDescription("");
      setAmount("");
      setNotes("");
      await utils.transaction.list.invalidate();
      await utils.account.list.invalidate();
      await utils.dashboard.summary.invalidate();
      await navigate({ to: "/transactions" });
    },
  });

  useEffect(() => {
    if (categoryId) return;
    if (defaultCategoryId) setCategoryId(defaultCategoryId);
  }, [categoryId, defaultCategoryId]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!accountId) {
      setFormError("Select an account.");
      return;
    }
    if (!categoryId) {
      setFormError("Select a category.");
      return;
    }
    if (!description.trim()) {
      setFormError("Description is required.");
      return;
    }

    const parsedAmount = Number(amount);
    if (
      !Number.isFinite(parsedAmount) ||
      !Number.isInteger(parsedAmount) ||
      parsedAmount <= 0
    ) {
      setFormError("Amount must be a positive integer.");
      return;
    }

    const parsedDate = new Date(`${date}T12:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      setFormError("Date is invalid.");
      return;
    }

    await createMutation.mutateAsync({
      accountId,
      categoryId,
      description: description.trim(),
      amount: mode === "deposit" ? parsedAmount : -parsedAmount,
      date: parsedDate,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl px-4 py-10">
      <div className="grid w-full gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {mode === "deposit" ? "Register Deposit" : "Register Expense"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={(event) => void onSubmit(event)}
            >
              <label className="grid gap-1 text-sm">
                Account
                <select
                  className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                >
                  <option value="">Select account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                Category
                <select
                  className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Select category</option>
                  {filteredCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm md:col-span-2">
                Description
                <Input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>

              <label className="grid gap-1 text-sm">
                Amount
                <Input
                  type="number"
                  step={1}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="5000"
                />
              </label>

              <label className="grid gap-1 text-sm">
                Date
                <Input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>

              <label className="grid gap-1 text-sm md:col-span-2">
                Notes (optional)
                <Input value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>

              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending
                    ? "Posting..."
                    : mode === "deposit"
                      ? "Post deposit"
                      : "Post expense"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void navigate({ to: "/transactions" })}
                >
                  Back to transactions
                </Button>
              </div>

              {formError ? (
                <p className="text-sm text-red-600 md:col-span-2">{formError}</p>
              ) : null}
              {createMutation.error?.message ? (
                <p className="text-sm text-red-600 md:col-span-2">
                  {createMutation.error.message}
                </p>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentTransactionsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : null}
            {(recentTransactionsQuery.data ?? []).slice(0, 5).map((transaction) => (
              <div key={transaction.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{transaction.description}</p>
                  <p className="text-sm">
                    {formatCurrencyByLanguage(
                      transaction.amount,
                      transaction.account.currency,
                      i18n.language,
                    )}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {transaction.account.name} · {transaction.category.name} ·{" "}
                  {formatDateByLanguage(transaction.date, i18n.language)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
