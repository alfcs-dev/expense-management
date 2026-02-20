import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2Icon, CreditCardIcon, InfoIcon, LandmarkIcon } from "lucide-react";
import { useFormContext } from "react-hook-form";
import valid from "card-validator";
import {
  computeDueDayFromGrace,
  isAccountErrorCode,
  parseClabe,
} from "@expense-management/shared";
import { Button } from "@components/ui/Button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@components/ui/Field";
import { Input } from "@components/ui/Input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@components/ui/InputGroup";
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/Popover";
import type { AccountFormValues } from "@expense-management/shared";
import type { AccountType } from "@expense-management/shared";

const ACCOUNT_TYPES: AccountType[] = [
  "debit",
  "savings",
  "investment",
  "cash",
  "credit",
  "credit_card",
];

type InstitutionOption = {
  id: string;
  name: string;
  bankCode: string | null;
};

export type AccountFormProps = {
  onCancel: () => void;
  /** Called when user clicks Create/Save; triggers validation and submit. Use so submit works inside portaled Sheet. */
  onRequestSubmit: () => void;
  formError: string | null;
  createErrorMessage: string | null;
  updateErrorMessage: string | null;
  isSaving: boolean;
  institutions: InstitutionOption[];
  editingId: string | null;
};

export function AccountForm({
  onCancel,
  onRequestSubmit,
  formError,
  createErrorMessage,
  updateErrorMessage,
  isSaving,
  institutions,
  editingId,
}: AccountFormProps) {
  const { t } = useTranslation();
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<AccountFormValues>();

  const resolveError = (message: string | undefined) => {
    if (!message) return "";
    return isAccountErrorCode(message) ? t(`accounts.errors.${message}`) : message;
  };

  const accountTypeOptions = useMemo(
    () =>
      ACCOUNT_TYPES.map((value) => ({
        value,
        label: t(`accounts.types.${value}`),
      })),
    [t],
  );

  const [cardNumberInput, setCardNumberInput] = useState("");

  const type = watch("type");
  const institutionId = watch("institutionId");
  const transferProfileClabe = watch("transferProfile.clabe");
  const cardBrand = watch("cardProfile.brand");
  const cardLast4 = watch("cardProfile.last4");
  const statementDay = watch("creditCardSettings.statementDay");
  const graceDays = watch("creditCardSettings.graceDays");

  const isCreditCardType = type === "credit_card" || type === "credit";
  const isCreditCycleType = type === "credit_card";
  const computedDueDay =
    isCreditCycleType &&
    typeof statementDay === "number" &&
    !Number.isNaN(statementDay) &&
    typeof graceDays === "number" &&
    !Number.isNaN(graceDays)
      ? computeDueDayFromGrace(statementDay, graceDays)
      : null;

  const clabeCheck = useMemo(
    () => parseClabe(transferProfileClabe ?? ""),
    [transferProfileClabe],
  );

  const selectedInstitutionName = useMemo(() => {
    const inst = institutions.find((i) => i.id === institutionId);
    return inst?.name ?? clabeCheck.bankName ?? t("accounts.form.notSelected");
  }, [institutionId, institutions, clabeCheck.bankName, t]);

  const handleCardNumberChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 19);
    setCardNumberInput(digits);
    const verification = valid.number(digits);
    const brand = verification.card?.type ?? "";
    const last4 = digits.length >= 4 ? digits.slice(-4) : "";
    setValue("cardProfile", { brand: brand || undefined, last4: last4 || undefined });
  };

  return (
    <div className="mt-4 grid gap-3 pb-4">
      <FieldGroup className="gap-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("accounts.form.sectionAccountDetails")}
        </p>
        <Field>
          <FieldLabel htmlFor="account-name">
            {t("accounts.form.accountName")}{" "}
            <span className="text-red-500" aria-hidden="true">
              *
            </span>
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="account-name"
              {...register("name")}
              placeholder={t("accounts.form.placeholders.name")}
              maxLength={100}
            />
            <InputGroupAddon>
              <Building2Icon />
            </InputGroupAddon>
          </InputGroup>
          {errors.name ? (
            <FieldDescription className="text-red-600">
              {resolveError(errors.name.message)}
            </FieldDescription>
          ) : null}
        </Field>

        <div className="grid gap-3 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="account-type">
              {t("accounts.fields.type")}{" "}
              <span className="text-red-500" aria-hidden="true">
                *
              </span>
            </FieldLabel>
            <select
              id="account-type"
              className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
              {...register("type")}
            >
              {accountTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.type ? (
              <FieldDescription className="text-red-600">
                {resolveError(errors.type.message)}
              </FieldDescription>
            ) : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="account-currency">
              {t("accounts.fields.currency")}{" "}
              <span className="text-red-500" aria-hidden="true">
                *
              </span>
            </FieldLabel>
            <select
              id="account-currency"
              className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
              {...register("currency")}
            >
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>
            {errors.currency ? (
              <FieldDescription className="text-red-600">
                {resolveError(errors.currency.message)}
              </FieldDescription>
            ) : null}
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="account-current-balance">
            {t("accounts.form.currentBalance")}
          </FieldLabel>
          <Input
            id="account-current-balance"
            type="number"
            step="1"
            placeholder="0"
            {...register("currentBalance", { valueAsNumber: true })}
          />
          <FieldDescription>{t("accounts.form.currentBalanceHint")}</FieldDescription>
        </Field>

        <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("accounts.form.sectionTransferProfile")}
        </p>
        <Field>
          <FieldLabel htmlFor="account-clabe">{t("accounts.clabeLabel")}</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="account-clabe"
              {...register("transferProfile.clabe")}
              placeholder={t("accounts.form.placeholders.clabeDigits")}
              maxLength={22}
            />
            <InputGroupAddon>
              <LandmarkIcon />
            </InputGroupAddon>
          </InputGroup>
          {errors.transferProfile?.clabe ? (
            <FieldDescription className="text-red-600">
              {resolveError(errors.transferProfile.clabe.message)}
            </FieldDescription>
          ) : null}
          {transferProfileClabe ? (
            <FieldDescription
              className={clabeCheck.isValid ? "text-emerald-600" : "text-red-600"}
            >
              {clabeCheck.isValid
                ? `${t("accounts.form.validClabe")}${clabeCheck.bankCode ? ` · ${t("accounts.form.bankCode", { code: clabeCheck.bankCode })}` : ""}`
                : t("accounts.form.invalidClabe")}
            </FieldDescription>
          ) : null}
          <FieldDescription>
            {t("accounts.form.institutionLabel")}: {selectedInstitutionName}
          </FieldDescription>
        </Field>

        <div className="grid gap-3 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="deposit-reference">
              {t("accounts.form.depositReference")}
            </FieldLabel>
            <Input
              id="deposit-reference"
              {...register("transferProfile.depositReference")}
              placeholder={t("accounts.form.placeholders.referenceOrAlias")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="beneficiary-name">
              {t("accounts.form.beneficiaryName")}
            </FieldLabel>
            <Input
              id="beneficiary-name"
              {...register("transferProfile.beneficiaryName")}
              placeholder={t("accounts.form.placeholders.whoReceives")}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="institution-code">
            {t("accounts.form.institutionLabel")}
          </FieldLabel>
          <select
            id="institution-code"
            className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
            {...register("institutionId")}
          >
            <option value="">{t("accounts.form.placeholders.none")}</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name} ({institution.bankCode})
              </option>
            ))}
          </select>
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("transferProfile.isProgrammable")} />
          {t("accounts.form.programmableTransferProfile")}
        </label>

        {isCreditCardType ? (
          <>
            <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("accounts.form.sectionCardDetails")}
            </p>
            <Field>
              <div className="flex items-center gap-2">
                <FieldLabel htmlFor="card-number-input">
                  {t("accounts.form.cardNumber")}
                </FieldLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="h-6 w-6 rounded-full"
                    >
                      <InfoIcon className="size-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 text-sm">
                    {t("accounts.form.cardNumberHint")}
                  </PopoverContent>
                </Popover>
              </div>
              <InputGroup>
                <InputGroupInput
                  id="card-number-input"
                  value={cardNumberInput}
                  onChange={(e) => handleCardNumberChange(e.target.value)}
                  placeholder={t("accounts.form.placeholders.cardNumber")}
                  maxLength={22}
                />
                <InputGroupAddon>
                  <CreditCardIcon />
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                {cardBrand
                  ? t("accounts.form.detectedBrand", { brand: cardBrand })
                  : t("accounts.form.detectedBrandPending")}
                {cardLast4
                  ? ` · ${t("accounts.form.storedLast4", { last4: cardLast4 })}`
                  : ""}
              </FieldDescription>
              <FieldDescription>
                {t("accounts.form.institutionLabel")}: {selectedInstitutionName}
              </FieldDescription>
            </Field>
            {isCreditCycleType ? (
              <div className="grid gap-3 md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="statement-day">
                    {t("accounts.form.statementDay")}
                  </FieldLabel>
                  <Input
                    id="statement-day"
                    type="number"
                    min={1}
                    max={31}
                    placeholder="15"
                    {...register("creditCardSettings.statementDay", {
                      valueAsNumber: true,
                    })}
                  />
                  {errors.creditCardSettings?.statementDay ? (
                    <FieldDescription className="text-red-600">
                      {resolveError(errors.creditCardSettings.statementDay.message)}
                    </FieldDescription>
                  ) : null}
                  <FieldDescription>
                    {t("accounts.form.statementDayHint")}
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="grace-days">
                    {t("accounts.form.graceDays")}
                  </FieldLabel>
                  <Input
                    id="grace-days"
                    type="number"
                    min={0}
                    max={90}
                    placeholder="20"
                    {...register("creditCardSettings.graceDays", {
                      valueAsNumber: true,
                    })}
                  />
                  {errors.creditCardSettings?.graceDays ? (
                    <FieldDescription className="text-red-600">
                      {resolveError(errors.creditCardSettings.graceDays.message)}
                    </FieldDescription>
                  ) : null}
                  {computedDueDay != null ? (
                    <FieldDescription>
                      {t("accounts.form.computedDueDay", {
                        day: computedDueDay,
                      })}
                    </FieldDescription>
                  ) : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor="credit-limit">
                    {t("accounts.form.creditLimit")}
                  </FieldLabel>
                  <Input
                    id="credit-limit"
                    type="number"
                    min={0}
                    step="1"
                    placeholder="0"
                    {...register("creditCardSettings.creditLimit", {
                      valueAsNumber: true,
                    })}
                  />
                  <FieldDescription>
                    {t("accounts.form.creditLimitHint")}
                  </FieldDescription>
                </Field>
              </div>
            ) : null}
          </>
        ) : null}
      </FieldGroup>

      {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
      {createErrorMessage ? (
        <p className="text-sm text-red-600">{resolveError(createErrorMessage)}</p>
      ) : null}
      {updateErrorMessage ? (
        <p className="text-sm text-red-600">{resolveError(updateErrorMessage)}</p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("accounts.form.cancel")}
        </Button>
        <Button type="button" disabled={isSaving} onClick={onRequestSubmit}>
          {isSaving
            ? t("accounts.form.saving")
            : editingId
              ? t("accounts.form.saveChanges")
              : t("accounts.form.create")}
        </Button>
      </div>
    </div>
  );
}
