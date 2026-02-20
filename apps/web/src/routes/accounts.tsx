import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MoreVerticalIcon } from "lucide-react";
import { createRoute } from "@tanstack/react-router";
import type { Resolver } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { parseClabe } from "@expense-management/shared";
import {
  accountInputSchema,
  type AccountFormValues,
  type AccountInput,
} from "@expense-management/shared";
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
import { AccountForm } from "@components/accounts/AccountForm";

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

const defaultAccountFormValues: AccountFormValues = {
  name: "",
  type: "debit",
  currency: "MXN",
  isActive: true,
  institutionId: "",
  transferProfile: {
    clabe: "",
    depositReference: "",
    beneficiaryName: "",
    isProgrammable: false,
  },
  cardProfile: { brand: "", last4: "" },
  creditCardSettings: undefined,
};

export const accountsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/accounts",
  component: AccountsPage,
});

function AccountsPage() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsAccountId, setDetailsAccountId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const accountsQuery = trpc.account.list.useQuery();
  const institutionsQuery = trpc.institutionCatalog.list.useQuery({ limit: 100 });

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountInputSchema) as Resolver<AccountFormValues>,
    defaultValues: defaultAccountFormValues,
  });

  const { watch, setValue, reset } = form;
  const watchClabe = watch("transferProfile.clabe");
  const watchInstitutionId = watch("institutionId");
  const watchType = watch("type");

  const clabeCheck = useMemo(() => parseClabe(watchClabe ?? ""), [watchClabe]);

  useEffect(() => {
    if (!clabeCheck.isValid || !clabeCheck.bankCode || watchInstitutionId) return;
    const inferred = institutionsQuery.data?.find(
      (item) => item.bankCode === clabeCheck.bankCode,
    );
    if (inferred) setValue("institutionId", inferred.id);
  }, [
    clabeCheck.bankCode,
    clabeCheck.isValid,
    watchInstitutionId,
    institutionsQuery.data,
    setValue,
  ]);

  useEffect(() => {
    if (watchType === "credit_card") {
      const current = watch("creditCardSettings");
      if (current == null) {
        setValue("creditCardSettings", {
          statementDay: 15,
          graceDays: 20,
          creditLimit: undefined,
        });
      }
    }
  }, [watchType, watch, setValue]);

  const createMutation = trpc.account.create.useMutation({
    onSuccess: async () => {
      reset(defaultAccountFormValues);
      setFormError(null);
      setIsFormOpen(false);
      setEditingId(null);
      await utils.account.list.invalidate();
    },
  });

  const updateMutation = trpc.account.update.useMutation({
    onSuccess: async () => {
      reset(defaultAccountFormValues);
      setFormError(null);
      setIsFormOpen(false);
      setEditingId(null);
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

  const openCreate = () => {
    reset(defaultAccountFormValues);
    setFormError(null);
    setEditingId(null);
    setIsFormOpen(true);
  };

  const openEdit = (accountId: string) => {
    const account = accounts.find((item) => item.id === accountId);
    if (!account) return;

    reset({
      name: account.name,
      type: account.type,
      currency: account.currency,
      currentBalance: account.currentBalance ?? 0,
      isActive: true,
      institutionId: account.institutionId ?? "",
      transferProfile: {
        clabe: account.transferProfile?.clabe ?? "",
        depositReference: account.transferProfile?.depositReference ?? "",
        beneficiaryName: account.transferProfile?.beneficiaryName ?? "",
        isProgrammable: account.transferProfile?.isProgrammable ?? false,
      },
      cardProfile: account.cardProfile
        ? {
            brand: account.cardProfile.brand ?? "",
            last4: account.cardProfile.last4 ?? "",
          }
        : { brand: "", last4: "" },
      creditCardSettings:
        account.type === "credit_card" && account.creditCardSettings
          ? {
              statementDay: account.creditCardSettings.statementDay,
              graceDays: account.creditCardSettings.graceDays ?? 20,
              creditLimit: account.creditCardSettings.creditLimit ?? undefined,
            }
          : undefined,
    });
    setFormError(null);
    setEditingId(account.id);
    setIsFormOpen(true);
  };

  const openDetails = (accountId: string) => {
    setDetailsAccountId(accountId);
    setIsDetailsOpen(true);
  };

  const onFormSubmit = async (data: AccountInput) => {
    setFormError(null);

    const hasTransferProfile =
      (data.transferProfile?.clabe?.trim() ?? "") !== "" ||
      (data.transferProfile?.depositReference?.trim() ?? "") !== "" ||
      (data.transferProfile?.beneficiaryName?.trim() ?? "") !== "" ||
      data.transferProfile?.isProgrammable === true;

    const hasCardProfile =
      (data.cardProfile?.brand?.trim() ?? "") !== "" ||
      (data.cardProfile?.last4?.trim() ?? "") !== "";

    const payload: AccountInput = {
      ...data,
      institutionId: data.institutionId ?? undefined,
      transferProfile: hasTransferProfile ? data.transferProfile : undefined,
      cardProfile: hasCardProfile ? data.cardProfile : null,
    };

    if (editingId) {
      await updateMutation.mutateAsync({
        id: editingId,
        data: payload as Parameters<typeof updateMutation.mutateAsync>[0]["data"],
      });
    } else {
      await createMutation.mutateAsync(
        payload as Parameters<typeof createMutation.mutateAsync>[0],
      );
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isMutating = isSaving || deleteMutation.isPending;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl px-4 py-10">
      <div className="grid w-full gap-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold">{t("accounts.title")}</h1>
          <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
            <SheetTrigger asChild>
              <Button onClick={openCreate}>{t("accounts.create")}</Button>
            </SheetTrigger>
            <SheetContent side="right" className="overflow-y-auto">
              <SheetHeader>
                <SheetTitle>
                  {editingId ? t("accounts.sheetEdit") : t("accounts.sheetCreate")}
                </SheetTitle>
                <SheetDescription>{t("accounts.sheetDescription")}</SheetDescription>
              </SheetHeader>
              <form
                onSubmit={(e) =>
                  void form.handleSubmit(
                    (data) => void onFormSubmit(data as unknown as AccountInput),
                  )(e)
                }
              >
                <FormProvider {...form}>
                  <AccountForm
                    key={editingId ?? "new"}
                    onCancel={() => setIsFormOpen(false)}
                    onRequestSubmit={() =>
                      void form.handleSubmit(
                        (data) => void onFormSubmit(data as unknown as AccountInput),
                      )()
                    }
                    formError={formError}
                    createErrorMessage={createMutation.error?.message ?? null}
                    updateErrorMessage={updateMutation.error?.message ?? null}
                    isSaving={isSaving}
                    institutions={institutions}
                    editingId={editingId}
                  />
                </FormProvider>
              </form>
            </SheetContent>
          </Sheet>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("accounts.listTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="min-h-[340px] space-y-3">
            {accountsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">{t("accounts.loading")}</p>
            ) : null}
            {!accountsQuery.isLoading && accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("accounts.empty")}</p>
            ) : null}

            {accounts.map((account) => {
              const clabeValue = account.transferProfile?.clabe ?? "";
              const hasClabe = Boolean(clabeValue);
              const displayIdentifier = hasClabe
                ? maskClabe(clabeValue)
                : account.cardProfile?.last4
                  ? `**** ${account.cardProfile.last4}`
                  : t("accounts.noIdentifier");
              const brandLabel = account.cardProfile?.brand ?? "";
              const brandIcon = brandIcons[brandLabel] ?? (brandLabel ? "C" : "A");
              const institutionLabel =
                account.institution?.name ?? t("accounts.noInstitution");

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
                      {t(`accounts.types.${account.type}`)} · {account.currency} ·{" "}
                      {displayIdentifier}
                    </p>
                    {account.creditCardSettings ? (
                      <p className="mt-1 hidden text-xs text-muted-foreground md:block">
                        {t("accounts.form.cycleStatement", {
                          statement: account.creditCardSettings.statementDay,
                          grace: account.creditCardSettings.graceDays ?? 0,
                        })}
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
                        {t("accounts.copyClabe")}
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
                          {t("accounts.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openDetails(account.id)}>
                          {t("accounts.moreInfo")}
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
                          {account.isActive
                            ? t("accounts.deactivate")
                            : t("accounts.activate")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() =>
                            void deleteMutation.mutateAsync({ id: account.id })
                          }
                          disabled={isMutating}
                        >
                          {t("accounts.delete")}
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
            <DialogTitle>{detailsAccount?.name ?? t("accounts.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("accounts.dialogDescription")}</DialogDescription>
          </DialogHeader>
          {detailsAccount ? (
            <div className="grid gap-2 text-sm">
              <p>
                <strong>{t("accounts.fields.type")}:</strong>{" "}
                {t(`accounts.types.${detailsAccount.type}`)}
              </p>
              <p>
                <strong>{t("accounts.fields.currency")}:</strong>{" "}
                {detailsAccount.currency}
              </p>
              <p>
                <strong>{t("accounts.institutionLabel")}:</strong>{" "}
                {detailsAccount.institution?.name ?? t("accounts.na")}
              </p>
              <p>
                <strong>{t("accounts.clabeLabel")}:</strong>{" "}
                {detailsAccount.transferProfile?.clabe ?? t("accounts.na")}
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
                  {t("accounts.copyFullClabe")}
                </Button>
              ) : null}
              <p>
                <strong>{t("accounts.form.depositReference")}:</strong>{" "}
                {detailsAccount.transferProfile?.depositReference ?? t("accounts.na")}
              </p>
              <p>
                <strong>{t("accounts.form.beneficiaryName")}:</strong>{" "}
                {detailsAccount.transferProfile?.beneficiaryName ?? t("accounts.na")}
              </p>
              <p>
                <strong>{t("accounts.form.cardBrand")}:</strong>{" "}
                {detailsAccount.cardProfile?.brand ?? t("accounts.na")}
              </p>
              <p>
                <strong>{t("accounts.form.cardLast4")}:</strong>{" "}
                {detailsAccount.cardProfile?.last4 ?? t("accounts.na")}
              </p>
              {detailsAccount.creditCardSettings ? (
                <p>
                  <strong>{t("accounts.form.cycle")}:</strong>{" "}
                  {t("accounts.form.cycleStatement", {
                    statement: detailsAccount.creditCardSettings.statementDay,
                    grace: detailsAccount.creditCardSettings.graceDays ?? 0,
                  })}
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
