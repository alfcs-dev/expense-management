import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { protectedRoute } from "./protected";
import { trpc } from "../utils/trpc";
import { formatCurrencyByLanguage, formatDateByLanguage } from "../utils/locale";
import { Button } from "@components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/Card";
import { Input } from "@components/ui/Input";

export const creditCardStatementsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/credit-card-statements",
  component: CreditCardStatementsPage,
});

function toDateInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function CreditCardStatementsPage() {
  const { i18n } = useTranslation();
  const utils = trpc.useUtils();
  const accountsQuery = trpc.account.list.useQuery();

  const creditCardAccounts = useMemo(
    () => (accountsQuery.data ?? []).filter((account) => account.type === "credit_card"),
    [accountsQuery.data],
  );

  const [accountId, setAccountId] = useState("");
  const [periodStart, setPeriodStart] = useState(toDateInput(new Date()));
  const [periodEnd, setPeriodEnd] = useState(toDateInput(new Date()));
  const [closingDate, setClosingDate] = useState(toDateInput(new Date()));
  const [statementId, setStatementId] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [amountApplied, setAmountApplied] = useState("");
  const [paymentDate, setPaymentDate] = useState(toDateInput(new Date()));
  const [paymentNotes, setPaymentNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId && creditCardAccounts.length > 0) {
      setAccountId(creditCardAccounts[0].id);
    }
  }, [accountId, creditCardAccounts]);

  const statementsQuery = trpc.creditCardStatement.list.useQuery(
    accountId ? { accountId } : undefined,
    { enabled: !!accountId },
  );
  const fundingAccounts = useMemo(
    () => (accountsQuery.data ?? []).filter((account) => account.id !== accountId),
    [accountId, accountsQuery.data],
  );

  const closeMutation = trpc.creditCardStatement.close.useMutation({
    onSuccess: async () => {
      setFormError(null);
      if (accountId) {
        await utils.creditCardStatement.list.invalidate({ accountId });
      }
      await utils.account.list.invalidate();
    },
  });
  const recordPaymentMutation = trpc.creditCardStatement.recordPayment.useMutation({
    onSuccess: async () => {
      setPaymentError(null);
      setAmountApplied("");
      setPaymentNotes("");
      if (accountId) {
        await utils.creditCardStatement.list.invalidate({ accountId });
      }
      await utils.account.list.invalidate();
    },
  });

  useEffect(() => {
    const firstStatementId = statementsQuery.data?.[0]?.id ?? "";
    if (!statementId || !(statementsQuery.data ?? []).some((s) => s.id === statementId)) {
      setStatementId(firstStatementId);
    }
  }, [statementId, statementsQuery.data]);

  useEffect(() => {
    if (!fromAccountId && fundingAccounts.length > 0) {
      setFromAccountId(fundingAccounts[0].id);
    }
  }, [fromAccountId, fundingAccounts]);

  const onCloseStatement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!accountId) {
      setFormError("Select a credit card account first.");
      return;
    }

    const start = new Date(`${periodStart}T00:00:00.000Z`);
    const end = new Date(`${periodEnd}T23:59:59.999Z`);
    const closeDate = new Date(`${closingDate}T12:00:00.000Z`);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      Number.isNaN(closeDate.getTime())
    ) {
      setFormError("Invalid dates. Please review period and closing date.");
      return;
    }

    if (end < start) {
      setFormError("Period end must be after period start.");
      return;
    }

    await closeMutation.mutateAsync({
      accountId,
      periodStart: start,
      periodEnd: end,
      closingDate: closeDate,
    });
  };

  const onRecordPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPaymentError(null);
    if (!statementId) {
      setPaymentError("Select a statement first.");
      return;
    }
    if (!fromAccountId) {
      setPaymentError("Select the source account.");
      return;
    }
    const parsedAmount = Number(amountApplied);
    if (
      !Number.isFinite(parsedAmount) ||
      !Number.isInteger(parsedAmount) ||
      parsedAmount <= 0
    ) {
      setPaymentError("Amount must be a positive integer.");
      return;
    }
    const parsedDate = new Date(`${paymentDate}T12:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      setPaymentError("Payment date is invalid.");
      return;
    }

    await recordPaymentMutation.mutateAsync({
      statementId,
      fromAccountId,
      amountApplied: parsedAmount,
      date: parsedDate,
      notes: paymentNotes.trim() || undefined,
    });
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl px-4 py-10">
      <div className="grid w-full gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Credit Card Statements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="grid gap-1 text-sm">
              Credit card account
              <select
                className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                <option value="">Select account</option>
                {creditCardAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>

            <form
              className="grid gap-3 md:grid-cols-4"
              onSubmit={(event) => void onCloseStatement(event)}
            >
              <label className="grid gap-1 text-sm">
                Period start
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(event) => setPeriodStart(event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Period end
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(event) => setPeriodEnd(event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Closing date
                <Input
                  type="date"
                  value={closingDate}
                  onChange={(event) => setClosingDate(event.target.value)}
                />
              </label>
              <div className="flex items-end">
                <Button type="submit" disabled={closeMutation.isPending || !accountId}>
                  {closeMutation.isPending ? "Closing..." : "Close statement"}
                </Button>
              </div>
            </form>
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            {closeMutation.error?.message ? (
              <p className="text-sm text-red-600">{closeMutation.error.message}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {statementsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : null}
            {!statementsQuery.isLoading && (statementsQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No statements yet.</p>
            ) : null}
            {(statementsQuery.data?.length ?? 0) > 0 ? (
              <form
                className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-5"
                onSubmit={(event) => void onRecordPayment(event)}
              >
                <label className="grid gap-1 text-sm">
                  Statement
                  <select
                    className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
                    value={statementId}
                    onChange={(event) => setStatementId(event.target.value)}
                  >
                    {(statementsQuery.data ?? []).map((statement) => (
                      <option key={statement.id} value={statement.id}>
                        {formatDateByLanguage(statement.closingDate, i18n.language)} ·{" "}
                        {statement.status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  From account
                  <select
                    className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
                    value={fromAccountId}
                    onChange={(event) => setFromAccountId(event.target.value)}
                  >
                    <option value="">Select account</option>
                    {fundingAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  Amount (minor units)
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={amountApplied}
                    onChange={(event) => setAmountApplied(event.target.value)}
                    placeholder="100000"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Payment date
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                  />
                </label>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    disabled={recordPaymentMutation.isPending || !statementId}
                  >
                    {recordPaymentMutation.isPending ? "Recording..." : "Record payment"}
                  </Button>
                </div>
                <label className="grid gap-1 text-sm md:col-span-5">
                  Notes (optional)
                  <Input
                    value={paymentNotes}
                    onChange={(event) => setPaymentNotes(event.target.value)}
                    placeholder="Statement payment"
                  />
                </label>
                {paymentError ? (
                  <p className="text-sm text-red-600">{paymentError}</p>
                ) : null}
                {recordPaymentMutation.error?.message ? (
                  <p className="text-sm text-red-600">
                    {recordPaymentMutation.error.message}
                  </p>
                ) : null}
              </form>
            ) : null}
            {(statementsQuery.data ?? []).map((statement) => (
              <div key={statement.id} className="rounded-xl border border-border p-3">
                <p className="text-sm font-medium">{statement.account.name}</p>
                <p className="text-sm text-muted-foreground">
                  Closing: {formatDateByLanguage(statement.closingDate, i18n.language)} ·
                  Due: {formatDateByLanguage(statement.dueDate, i18n.language)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Balance:{" "}
                  {formatCurrencyByLanguage(
                    statement.statementBalance,
                    statement.account.currency,
                    i18n.language,
                  )}{" "}
                  · Applied:{" "}
                  {formatCurrencyByLanguage(
                    statement.paymentsApplied,
                    statement.account.currency,
                    i18n.language,
                  )}{" "}
                  · Status: {statement.status}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
