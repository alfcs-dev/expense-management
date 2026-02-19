import { FormEvent, useEffect, useMemo, useState } from "react";
import { MoreVerticalIcon } from "lucide-react";
import valid from "card-validator";
import { createRoute } from "@tanstack/react-router";
import { parseClabe } from "@expense-management/shared";
import { protectedRoute } from "./protected";
import { trpc } from "../utils/trpc";
import { Button } from "@components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/Card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/DropdownMenu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@components/ui/Dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@components/ui/Sheet";
import {
  AccountForm,
  emptyFormState,
  type AccountType,
  type Currency,
  type FormState,
} from "@components/accounts/AccountForm";

const brandIcons: Record<string, string> = {
  visa: "V",
  mastercard: "M",
  "american-express": "A",
  amex: "A",
};

function maskClabe(value: string): string {
  if (value.length <= 4) return value;
  return `**************${value.slice(-4)}`;
}

export const accountsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/accounts",
  component: AccountsPage,
});

function AccountsPage() {
  const utils = trpc.useUtils();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsAccountId, setDetailsAccountId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(emptyFormState);

  const accountsQuery = trpc.account.list.useQuery();
  const institutionsQuery = trpc.institutionCatalog.list.useQuery({ limit: 100 });

  const createMutation = trpc.account.create.useMutation({
    onSuccess: async () => {
      setFormState(emptyFormState);
      setFormError(null);
      setIsFormOpen(false);
      await utils.account.list.invalidate();
    },
  });

  const updateMutation = trpc.account.update.useMutation({
    onSuccess: async () => {
      setFormState(emptyFormState);
      setFormError(null);
      setIsFormOpen(false);
      await utils.account.list.invalidate();
    },
  });

  const deleteMutation = trpc.account.delete.useMutation({
    onSuccess: async () => {
      await utils.account.list.invalidate();
    },
  });

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const institutions = useMemo(
    () => institutionsQuery.data ?? [],
    [institutionsQuery.data],
  );
  const detailsAccount = useMemo(
    () => accounts.find((account) => account.id === detailsAccountId) ?? null,
    [accounts, detailsAccountId],
  );
  const selectedInstitution = useMemo(() => {
    const selectedInstitution = institutions.find(
      (institution) => institution.id === formState.institutionId,
    );
    return (selectedInstitution ?? formState.institutionId)
      ? { id: formState.institutionId, name: "" }
      : null;
  }, [formState.institutionId, institutions]);

  const clabeCheck = useMemo(() => parseClabe(formState.clabe), [formState.clabe]);
  const isCreditCardType =
    formState.type === "credit_card" || formState.type === "credit";
  const isCreditCycleType = formState.type === "credit_card";

  useEffect(() => {
    if (!clabeCheck.isValid || !clabeCheck.bankCode || formState.institutionId) return;
    const inferred = institutions.find((item) => item.bankCode === clabeCheck.bankCode);
    if (inferred) {
      setFormState((prev) => ({ ...prev, institutionId: inferred.id }));
    }
  }, [clabeCheck.bankCode, clabeCheck.isValid, formState.institutionId, institutions]);

  const onChangeCardNumber = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 19);
    const verification = valid.number(digits);
    const cardType = verification.card?.type ?? "";
    const last4 = digits.length >= 4 ? digits.slice(-4) : "";

    setFormState((prev) => ({
      ...prev,
      cardNumberInput: digits,
      cardBrand: cardType || "",
      cardLast4: last4,
    }));
  };

  const openCreate = () => {
    setFormState(emptyFormState);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEdit = (accountId: string) => {
    const account = accounts.find((item) => item.id === accountId);
    if (!account) return;

    setFormState({
      id: account.id,
      name: account.name,
      type: account.type as AccountType,
      currency: account.currency as Currency,
      clabe: account.transferProfile?.clabe ?? "",
      depositReference: account.transferProfile?.depositReference ?? "",
      beneficiaryName: account.transferProfile?.beneficiaryName ?? "",
      bankName: account.transferProfile?.bankName ?? "",
      institutionId: account.institutionId ?? "",
      isProgrammable: account.transferProfile?.isProgrammable ?? false,
      cardNumberInput: "",
      cardBrand: account.cardProfile?.brand ?? "",
      cardLast4: account.cardProfile?.last4 ?? "",
      statementDay: String(account.creditCardSettings?.statementDay ?? 15),
      dueDay: String(account.creditCardSettings?.dueDay ?? 5),
      graceDays: String(account.creditCardSettings?.graceDays ?? 20),
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const openDetails = (accountId: string) => {
    setDetailsAccountId(accountId);
    setIsDetailsOpen(true);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!formState.name.trim()) {
      setFormError("Name is required.");
      return;
    }

    if (formState.clabe && !clabeCheck.isValid) {
      setFormError("Invalid CLABE.");
      return;
    }

    const transferProfileDefined =
      formState.clabe ||
      formState.depositReference ||
      formState.beneficiaryName ||
      formState.bankName ||
      formState.isProgrammable;

    const cardProfileDefined = formState.cardBrand || formState.cardLast4;

    const parsedStatementDay = Number(formState.statementDay);
    const parsedDueDay = Number(formState.dueDay);
    const parsedGraceDays = Number(formState.graceDays);

    if (isCreditCycleType) {
      if (
        !Number.isInteger(parsedStatementDay) ||
        parsedStatementDay < 1 ||
        parsedStatementDay > 31
      ) {
        setFormError("Statement day must be between 1 and 31.");
        return;
      }
      if (!Number.isInteger(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 31) {
        setFormError("Due day must be between 1 and 31.");
        return;
      }
      if (
        !Number.isInteger(parsedGraceDays) ||
        parsedGraceDays < 0 ||
        parsedGraceDays > 90
      ) {
        setFormError("Grace days must be between 0 and 90.");
        return;
      }
    }

    const payload = {
      name: formState.name.trim(),
      type: formState.type,
      currency: formState.currency,
      isActive: true,
      institutionId: formState.institutionId || null,
      transferProfile: transferProfileDefined
        ? {
            clabe: formState.clabe || undefined,
            depositReference: formState.depositReference || undefined,
            beneficiaryName: formState.beneficiaryName || undefined,
            bankName: formState.bankName || undefined,
            isProgrammable: formState.isProgrammable,
          }
        : undefined,
      cardProfile: cardProfileDefined
        ? {
            brand: formState.cardBrand || undefined,
            last4: formState.cardLast4 || undefined,
          }
        : null,
      creditCardSettings: isCreditCycleType
        ? {
            statementDay: parsedStatementDay,
            dueDay: parsedDueDay,
            graceDays: parsedGraceDays,
          }
        : undefined,
    };

    if (formState.id) {
      await updateMutation.mutateAsync({ id: formState.id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isMutating = isSaving || deleteMutation.isPending;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl px-4 py-10">
      <div className="grid w-full gap-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold">Accounts</h1>
          <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
            <SheetTrigger asChild>
              <Button onClick={openCreate}>Create account</Button>
            </SheetTrigger>
            <SheetContent side="right" className="overflow-y-auto">
              <SheetHeader>
                <SheetTitle>
                  {formState.id ? "Edit account" : "Create account"}
                </SheetTitle>
                <SheetDescription>
                  Configure account details, transfer profile, and optional card settings.
                </SheetDescription>
              </SheetHeader>
              <AccountForm
                formState={formState}
                setFormState={setFormState}
                onSubmit={onSubmit}
                onChangeCardNumber={onChangeCardNumber}
                onCancel={() => setIsFormOpen(false)}
                formError={formError}
                createErrorMessage={createMutation.error?.message ?? null}
                updateErrorMessage={updateMutation.error?.message ?? null}
                isSaving={isSaving}
                isCreditCardType={isCreditCardType}
                isCreditCycleType={isCreditCycleType}
                clabeCheck={clabeCheck}
                selectedInstitutionName={selectedInstitution?.name ?? null}
                institutions={institutions}
              />
            </SheetContent>
          </Sheet>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>List of accounts</CardTitle>
          </CardHeader>
          <CardContent className="min-h-[340px] space-y-3">
            {accountsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : null}
            {!accountsQuery.isLoading && accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accounts yet.</p>
            ) : null}

            {accounts.map((account) => {
              const clabeValue = account.transferProfile?.clabe ?? "";
              const hasClabe = Boolean(clabeValue);
              const displayIdentifier = hasClabe
                ? maskClabe(clabeValue)
                : account.cardProfile?.last4
                  ? `**** ${account.cardProfile.last4}`
                  : "No identifier";
              const brandLabel = account.cardProfile?.brand ?? "";
              const brandIcon = brandIcons[brandLabel] ?? (brandLabel ? "C" : "A");
              const institutionLabel =
                account.institution?.name ||
                account.transferProfile?.bankName ||
                "No institution";

              return (
                <div
                  key={account.id}
                  className="flex flex-col gap-3 rounded-xl border border-border p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-xs font-semibold">
                        {brandIcon}
                      </span>
                      <p className="font-medium">{account.name}</p>
                      <span className="text-xs text-muted-foreground">
                        {institutionLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {account.type} · {account.currency} · {displayIdentifier}
                    </p>
                    {account.creditCardSettings ? (
                      <p className="mt-1 hidden text-xs text-muted-foreground md:block">
                        statement day {account.creditCardSettings.statementDay} · due day{" "}
                        {account.creditCardSettings.dueDay} · grace{" "}
                        {account.creditCardSettings.graceDays ?? 0}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {hasClabe ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void navigator.clipboard.writeText(clabeValue)}
                      >
                        Copy CLABE
                      </Button>
                    ) : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon-sm">
                          <MoreVerticalIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => openEdit(account.id)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openDetails(account.id)}>
                          More info
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            void updateMutation.mutateAsync({
                              id: account.id,
                              data: { isActive: !account.isActive },
                            })
                          }
                          disabled={isMutating}
                        >
                          {account.isActive ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() =>
                            void deleteMutation.mutateAsync({ id: account.id })
                          }
                          disabled={isMutating}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailsAccount?.name ?? "Account details"}</DialogTitle>
            <DialogDescription>
              Complete account metadata for transfers and payments.
            </DialogDescription>
          </DialogHeader>
          {detailsAccount ? (
            <div className="grid gap-2 text-sm">
              <p>
                <strong>Type:</strong> {detailsAccount.type}
              </p>
              <p>
                <strong>Currency:</strong> {detailsAccount.currency}
              </p>
              <p>
                <strong>Institution:</strong>{" "}
                {detailsAccount.institution?.name ||
                  detailsAccount.transferProfile?.bankName ||
                  "N/A"}
              </p>
              <p>
                <strong>CLABE:</strong> {detailsAccount.transferProfile?.clabe ?? "N/A"}
              </p>
              {detailsAccount.transferProfile?.clabe ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-fit"
                  onClick={() =>
                    void navigator.clipboard.writeText(
                      detailsAccount.transferProfile?.clabe ?? "",
                    )
                  }
                >
                  Copy full CLABE
                </Button>
              ) : null}
              <p>
                <strong>Deposit reference:</strong>{" "}
                {detailsAccount.transferProfile?.depositReference ?? "N/A"}
              </p>
              <p>
                <strong>Beneficiary:</strong>{" "}
                {detailsAccount.transferProfile?.beneficiaryName ?? "N/A"}
              </p>
              <p>
                <strong>Card brand:</strong> {detailsAccount.cardProfile?.brand ?? "N/A"}
              </p>
              <p>
                <strong>Card last4:</strong> {detailsAccount.cardProfile?.last4 ?? "N/A"}
              </p>
              {detailsAccount.creditCardSettings ? (
                <p>
                  <strong>Cycle:</strong> statement{" "}
                  {detailsAccount.creditCardSettings.statementDay}, due{" "}
                  {detailsAccount.creditCardSettings.dueDay}, grace{" "}
                  {detailsAccount.creditCardSettings.graceDays ?? 0}
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
